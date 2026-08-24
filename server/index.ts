// server/server.js
import express from "express";
import dotenv from "dotenv";
dotenv.config({ path: `.env.${process.env.NODE_ENV}` });
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import morgan from "morgan";
import { z } from "zod";
import { generateStructured } from "./llm";
import cors from "cors";
import type {
  AllocateDaysRequest,
  DayAllocation,
  GenerateItineraryRequest,
  ItineraryStop,
  PlaceCategory,
} from "./types";

const app = express();
const port = process.env.PORT || 3001;

// Set MOCK_ITINERARY=true to skip the real Claude + OpenRouteService calls
// (both cost real money/quota) and replay a captured response while
// iterating on the frontend.
const USE_MOCK = process.env.MOCK_ITINERARY === "true";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mockResponse = USE_MOCK
  ? JSON.parse(fs.readFileSync(path.join(__dirname, "mock-response.json"), "utf-8"))
  : null;

app.use(morgan("dev"));
app.use(
  cors({
    origin: ["http://localhost:3001", "http://localhost:5173"],
  }),
);
app.use(express.json());

const ORS_API_KEY = process.env.OPENROUTESERVICE_API_KEY as string;

const COUNTRY_LABELS: Record<GenerateItineraryRequest["trip"]["country"], string> = {
  US: "United States",
  CA: "Canada",
};

// "HH:MM" (24-hour, from <input type="time">) -> "h:MM AM/PM", matching the
// prompt/schema's existing 12-hour time convention.
const formatTime = (hhmm: string) => {
  const [hourStr, minute] = hhmm.split(":");
  const hour = Number(hourStr);
  const period = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:${minute} ${period}`;
};

const addDays = (dateStr: string, offset: number) => {
  const date = new Date(`${dateStr}T00:00:00`);
  date.setDate(date.getDate() + offset);
  return date.toISOString().slice(0, 10);
};

// Free-tier geocoding occasionally matches an ambiguous place name (e.g. a
// venue name that also exists in another country) to a wildly wrong location.
const haversineKm = ([lngA, latA]: [number, number], [lngB, latB]: [number, number]) => {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(latB - latA);
  const dLng = toRad(lngB - lngA);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(latA)) * Math.cos(toRad(latB)) * Math.sin(dLng / 2) ** 2;
  return 2 * earthRadiusKm * Math.asin(Math.sqrt(a));
};

// OpenRouteService (and GeoJSON) coordinates are [lng, lat], not [lat, lng].
// `locationContext` (e.g. "San Francisco, United States") is appended to
// disambiguate bare place names - skip it for an address the user already
// typed in full (the starting location).
const geocode = async (address: string, locationContext?: string): Promise<[number, number]> => {
  const text = locationContext ? `${address}, ${locationContext}` : address;
  const params = new URLSearchParams({
    api_key: ORS_API_KEY,
    text,
    size: "1",
  });
  const response = await fetch(
    `https://api.openrouteservice.org/geocode/search?${params.toString()}`,
  );
  const data = await response.json();
  const coordinates = data?.features?.[0]?.geometry?.coordinates;
  if (!coordinates) {
    throw new Error(`Could not geocode address: "${text}"`);
  }
  return coordinates;
};

// Autocomplete ranks short prefixes badly without a focus point (verified live:
// "Mik" + boundary.country=CA alone surfaced an unrelated university building;
// adding a city-center focus point correctly ranked the real "Miku" restaurant).
// Cache per city+country since it's the same lookup for every keystroke.
const cityFocusPointCache = new Map<string, [number, number]>();
const getCityFocusPoint = async (
  city: string,
  countryLabel: string,
): Promise<[number, number] | null> => {
  const key = `${city}, ${countryLabel}`;
  if (cityFocusPointCache.has(key)) return cityFocusPointCache.get(key)!;
  try {
    const coordinate = await geocode(key);
    cityFocusPointCache.set(key, coordinate);
    return coordinate;
  } catch {
    return null;
  }
};

const calculateBestRoute = async (coordinates: [number, number][]) => {
  const response = await fetch(
    "https://api.openrouteservice.org/v2/directions/driving-car/geojson",
    {
      method: "POST",
      headers: {
        Authorization: ORS_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ coordinates }),
    },
  );
  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      `OpenRouteService directions error: ${data?.error?.message ?? response.statusText}`,
    );
  }

  return data;
};

// Some stops (islands, ferry-only landmarks) have no road network for the driving
// profile. Rather than fail the whole itinerary, drop those points and retry.
const calculateRouteDroppingUnroutableStops = async (
  coordinates: [number, number][],
  labels: string[],
) => {
  let remainingCoordinates = coordinates;
  let remainingLabels = labels;
  const omittedStops: string[] = [];

  while (true) {
    try {
      const directions = await calculateBestRoute(remainingCoordinates);
      return {
        directions,
        coordinates: remainingCoordinates,
        labels: remainingLabels,
        omittedStops,
      };
    } catch (error) {
      const match = (error as Error).message.match(/coordinate (\d+)/);
      if (!match || remainingCoordinates.length <= 2) throw error;

      const index = Number(match[1]);
      omittedStops.push(remainingLabels[index]);
      remainingCoordinates = remainingCoordinates.filter((_, i) => i !== index);
      remainingLabels = remainingLabels.filter((_, i) => i !== index);
    }
  }
};

// Reorders the FLEXIBLE stops between the fixed start/end for shortest total
// drive distance, via OpenRouteService's Optimization API. Stops in
// `pinnedLabels` (reservations - non-negotiable fixed-time commitments) keep
// their exact original position in the sequence; only the other stops are
// sent to the optimizer and slotted back into the remaining positions in the
// order it returns. Falls back to the original order on any failure
// (including a partial/unassigned result) rather than risk dropping a stop.
const optimizeStopOrder = async (
  coordinates: [number, number][],
  labels: string[],
  pinnedLabels: Set<string>,
): Promise<{ coordinates: [number, number][]; labels: string[] }> => {
  if (coordinates.length <= 3) {
    // Just start + at most one stop + end - nothing to reorder.
    return { coordinates, labels };
  }

  const start = coordinates[0];
  const middleCoordinates = coordinates.slice(1, -1);
  const middleLabels = labels.slice(1, -1);

  const flexibleIndices: number[] = [];
  middleLabels.forEach((label, i) => {
    if (!pinnedLabels.has(label)) flexibleIndices.push(i);
  });

  if (flexibleIndices.length <= 1) {
    // Nothing meaningful to reorder among the flexible stops.
    return { coordinates, labels };
  }

  const flexibleCoordinates = flexibleIndices.map((i) => middleCoordinates[i]);

  try {
    const response = await fetch("https://api.openrouteservice.org/optimization", {
      method: "POST",
      headers: {
        Authorization: ORS_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jobs: flexibleCoordinates.map((location, id) => ({ id, location })),
        vehicles: [{ id: 1, profile: "driving-car", start, end: start }],
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(`OpenRouteService optimization error: ${data?.error?.message ?? response.statusText}`);
    }

    const jobSteps: { job: number }[] = (data.routes?.[0]?.steps ?? []).filter(
      (step: { type: string }) => step.type === "job",
    );
    if (jobSteps.length !== flexibleCoordinates.length) {
      throw new Error("Optimization left some stops unassigned");
    }

    // Map optimized job order back to original middle-array indices.
    const optimizedFlexibleOrder = jobSteps.map((step) => flexibleIndices[step.job]);

    // Rebuild the middle sequence: pinned (reservation) stops keep their
    // original slot; flexible stops fill the remaining slots in the
    // optimized order, never moving across a pinned stop.
    const newMiddleCoordinates: [number, number][] = new Array(middleCoordinates.length);
    const newMiddleLabels: string[] = new Array(middleLabels.length);
    let flexibleCursor = 0;
    for (let i = 0; i < middleLabels.length; i++) {
      if (pinnedLabels.has(middleLabels[i])) {
        newMiddleCoordinates[i] = middleCoordinates[i];
        newMiddleLabels[i] = middleLabels[i];
      } else {
        const sourceIndex = optimizedFlexibleOrder[flexibleCursor++];
        newMiddleCoordinates[i] = middleCoordinates[sourceIndex];
        newMiddleLabels[i] = middleLabels[sourceIndex];
      }
    }

    return {
      coordinates: [start, ...newMiddleCoordinates, start],
      labels: ["Start", ...newMiddleLabels, "Start"],
    };
  } catch (error) {
    console.error("Route optimization failed, keeping original order:", error);
    return { coordinates, labels };
  }
};

// The itinerary list shown to the user should read in the same order the map
// actually visits stops - reorder it to match `stopLabels` (the final routed
// order), then append any stops that got dropped along the way so their notes
// are still visible even though they no longer have a matching map pin.
const reorderRouteToMatchStops = (
  route: ItineraryStop[],
  stopLabels: string[],
): ItineraryStop[] => {
  const visitedNames = stopLabels.filter((label) => label !== "Start");
  const ordered = visitedNames
    .map((name) => route.find((r) => r.placeName === name))
    .filter((r): r is ItineraryStop => Boolean(r));
  const orderedNames = new Set(ordered.map((r) => r.placeName));
  const dropped = route.filter((r) => !orderedNames.has(r.placeName));
  return [...ordered, ...dropped];
};

const itineraryStopSchema = z.object({
  placeName: z.string(),
  address: z.string().describe("The exact address to use for routing, taken from the input data"),
  category: z.string(),
  arrivalTime: z.string(),
  timeAtLocation: z.string().optional(),
  travelTimeFromPrevious: z.string(),
  notes: z
    .string()
    .describe("e.g. reservation needed, hours of operation, why it was skipped")
    .optional(),
});

const itineraryResponseSchema = z.object({
  route: z
    .array(itineraryStopSchema)
    .describe("The places to visit, in the order of the most efficient route"),
  metadata: z
    .object({
      estimatedTotalTime: z.string().optional(),
      estimatedTotalDistance: z.string().optional(),
    })
    .optional(),
  relevantInformation: z.array(z.string()).optional(),
});

const dayAllocationSchema = z.object({
  breakfast: z.array(z.string()).optional(),
  lunch: z.array(z.string()).optional(),
  dinner: z.array(z.string()).optional(),
  primaryActivities: z.array(z.string()).optional(),
  secondaryActivities: z.array(z.string()).optional(),
  lateNightActivities: z.array(z.string()).optional(),
});

const allocateDaysResponseSchema = z.object({
  days: z
    .array(dayAllocationSchema)
    .describe("One entry per day, in chronological order starting with day 1"),
});

// Real-time suggestions as the user types a place name, so they pick a real,
// already-geocoded place instead of typing a bare name that an LLM (Ollama
// models especially) would later have to reconstruct an address for - that
// reconstruction is exactly what was hallucinating wrong addresses.
app.get("/api/places/autocomplete", async (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q : "";
  const city = typeof req.query.city === "string" ? req.query.city : "";
  const country = req.query.country as GenerateItineraryRequest["trip"]["country"] | undefined;

  if (q.length < 3 || !city || !country || !COUNTRY_LABELS[country]) {
    res.json({ suggestions: [] });
    return;
  }

  if (USE_MOCK) {
    res.json({
      suggestions: [
        { name: q, address: `${q}, ${city}`, lat: 49.2827, lng: -123.1207 },
      ],
    });
    return;
  }

  try {
    const countryLabel = COUNTRY_LABELS[country];
    const focusPoint = await getCityFocusPoint(city, countryLabel);

    const params = new URLSearchParams({
      api_key: ORS_API_KEY,
      text: q,
      "boundary.country": country,
      layers: "venue,address",
      size: "5",
    });
    if (focusPoint) {
      params.set("focus.point.lon", String(focusPoint[0]));
      params.set("focus.point.lat", String(focusPoint[1]));
    }

    const response = await fetch(
      `https://api.openrouteservice.org/geocode/autocomplete?${params.toString()}`,
    );
    const data = await response.json();
    type PeliasFeature = {
      properties?: { name?: string; label?: string };
      geometry: { coordinates: [number, number] };
    };
    const suggestions = ((data?.features ?? []) as PeliasFeature[]).map((feature) => ({
      name: feature.properties?.name ?? feature.properties?.label,
      address: feature.properties?.label,
      lng: feature.geometry.coordinates[0],
      lat: feature.geometry.coordinates[1],
    }));

    res.json({ suggestions });
  } catch (error) {
    // A failed autocomplete must never block manual typing - it's a pure
    // enhancement, not a required step.
    console.error("Autocomplete failed:", error);
    res.json({ suggestions: [] });
  }
});

app.post("/api/itinerary", async (req, res) => {
  if (USE_MOCK) {
    res.json(mockResponse);
    return;
  }

  const body = req.body as GenerateItineraryRequest;
  const { trip, day, optimizeRoute } = body ?? {};
  if (!trip?.country || !trip?.city || !trip?.startingLocation || !day?.date) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }
  const shouldOptimize = optimizeRoute !== false;

  const startingLocation = trip.startingLocation;
  const countryLabel = COUNTRY_LABELS[trip.country];
  const locationContext = `${trip.city}, ${countryLabel}`;

  // Places/reservations picked from the autocomplete dropdown carry a
  // verified coordinate - trust that directly instead of re-geocoding
  // whatever address the LLM writes for that stop (see geocode loop below).
  const verifiedByName = new Map<string, [number, number]>();
  for (const place of [...(day.places ?? []), ...(day.reservations ?? [])]) {
    if (place.lat !== undefined && place.lng !== undefined) {
      verifiedByName.set(place.name, [place.lng, place.lat]);
    }
  }

  const bucketedPlaces: Record<PlaceCategory, string[]> = {
    breakfast: [],
    lunch: [],
    dinner: [],
    primaryActivities: [],
    secondaryActivities: [],
    lateNightActivities: [],
  };
  for (const place of day.places ?? []) {
    bucketedPlaces[place.category]?.push(place.name);
  }

  const reservations = (day.reservations ?? []).map((r) => ({
    name: r.name,
    time: formatTime(r.time),
    notes: r.notes,
  }));

  const data = {
    startingLocation,
    date: day.date,
    city: trip.city,
    country: countryLabel,
    reservations,
    data: bucketedPlaces,
  };

  try {
    const prompt = `You are an itinerary planner assistant. The user will provide the following information:
    - startingLocation: usually where they will be staying i.e, hotel, AirBnB, etc...
    - date: the date of the plan
    - city, country: the trip is entirely within this city - treat all place names as being in or near it
    - reservations: places the user has ALREADY booked, each with a fixed time that must NOT be moved
    - data: A JSON object with the following fields:
      - breakfast: Breakfast spots they want to visit.
      - primaryActivities: Primary activities they want to do today.
      - lunch: Lunch spots they want to visit.
      - dinner: Dinner spots they want to visit.
      - lateNightActivities: Activities they want to do after dinner.
      - secondaryActivities: The secondary places they want to visit if the locations are convenient to visit on the way to the primary places and on the way back to the starting location.

    Rules to follow:
    1. Determine the most efficient order to visit all the places in the least amount of time and distance traveled. Do not include startingLocation itself in the route array.
    2. Do your best to include all the places in the plan. However, if the locations are too far apart, or you run out of time, you are able to skip places. Just make a note of it in relevantInformation.
    3. Follow the natural course of a day (breakfast, lunch, dinner) and plan around that as much as possible.
    4. For each place, set "address" to a string that Google Maps can geocode: if the input entry includes a street address, copy it verbatim (do not paraphrase or invent one); if the input entry is just a landmark/place name with no address, use that name as-is since well-known landmarks resolve without a street address.
    5. For each place, add any relevant notes that would help the user, e.g. hours of operation, whether reservations are required.
    6. Every entry in "reservations" MUST appear in the route with its "arrivalTime" set exactly to its given time, and set "category" to "reservation". Schedule every other place around these fixed times - do not move them.
    7. Only include places that appear in "data" or "reservations". Do not invent additional stops.

    ${JSON.stringify(data)}`;

    const itinerary = await generateStructured(prompt, itineraryResponseSchema);
    const route: ItineraryStop[] = itinerary?.route ?? [];
    if (!itinerary || route.length === 0) {
      res.status(502).json({ error: "The AI returned an empty route", itinerary });
      return;
    }

    const addresses = [startingLocation, ...route.map((place) => place.address), startingLocation];
    const labels = ["Start", ...route.map((place) => place.placeName), "Start"];

    // Geocode sequentially to stay well within OpenRouteService's free-tier rate limit.
    // The starting location is already a full address the user typed; every other
    // stop only ever has a bare place name from the new intake form, so it needs
    // the city/country appended to disambiguate it.
    //
    // A single stop that can't be geocoded at all (no match found, as opposed to a
    // wildly-wrong match - see the haversine filter below) must not take down the
    // whole day's generation - e.g. one bad reservation name shouldn't 500 the
    // entire request. Drop it like any other unresolvable stop instead; only the
    // starting location itself is fatal, since routing can't proceed without it.
    const startCoordinateVerified: [number, number] | undefined =
      trip.startingLocationLat !== undefined && trip.startingLocationLng !== undefined
        ? [trip.startingLocationLng, trip.startingLocationLat]
        : undefined;

    const geocodeFailures: string[] = [];
    const geocodedCoordinates: [number, number][] = [];
    const geocodedLabels: string[] = [];
    for (let i = 0; i < addresses.length; i++) {
      const isStartingLocation = i === 0 || i === addresses.length - 1;
      const verified = isStartingLocation ? startCoordinateVerified : verifiedByName.get(labels[i]);
      if (verified) {
        geocodedCoordinates.push(verified);
        geocodedLabels.push(labels[i]);
        continue;
      }
      try {
        const coordinate = await geocode(addresses[i], isStartingLocation ? undefined : locationContext);
        geocodedCoordinates.push(coordinate);
        geocodedLabels.push(labels[i]);
      } catch (error) {
        if (isStartingLocation) throw error;
        console.error(`Could not geocode "${labels[i]}", dropping it:`, error);
        geocodeFailures.push(labels[i]);
      }
    }

    // Drop any stop whose geocode landed implausibly far from the starting point
    // (a mis-geocoded ambiguous place name) before it can blow up route distance.
    const MAX_STOP_DISTANCE_KM = 100;
    const startCoordinate = geocodedCoordinates[0];
    const misgeocodedStops: string[] = [];
    const coordinates: [number, number][] = [];
    const filteredLabels: string[] = [];
    geocodedCoordinates.forEach((coordinate, i) => {
      if (haversineKm(startCoordinate, coordinate) > MAX_STOP_DISTANCE_KM) {
        misgeocodedStops.push(geocodedLabels[i]);
        return;
      }
      coordinates.push(coordinate);
      filteredLabels.push(geocodedLabels[i]);
    });

    // Reservations are non-negotiable commitments - the optimizer should never move
    // them out of the position Claude already scheduled them at (it optimizes purely
    // for distance and has no concept of their fixed time), only reorder the flexible
    // stops around them.
    const pinnedLabels = new Set(
      route.filter((stop) => stop.category === "reservation").map((stop) => stop.placeName),
    );

    const { coordinates: orderedCoordinates, labels: orderedLabels } = shouldOptimize
      ? await optimizeStopOrder(coordinates, filteredLabels, pinnedLabels)
      : { coordinates, labels: filteredLabels };

    const {
      directions,
      coordinates: routedCoordinates,
      labels: routedLabels,
      omittedStops,
    } = await calculateRouteDroppingUnroutableStops(orderedCoordinates, orderedLabels);
    const feature = directions.features[0];

    res.json({
      itinerary: { ...itinerary, route: reorderRouteToMatchStops(route, routedLabels) },
      route: {
        geometry: feature.geometry.coordinates.map(([lng, lat]: [number, number]) => [lat, lng]),
        stops: routedCoordinates.map(([lng, lat], i) => ({ lat, lng, label: routedLabels[i] })),
        summary: feature.properties.summary,
        omittedStops: [...geocodeFailures, ...misgeocodedStops, ...omittedStops],
      },
    });
  } catch (error) {
    console.error("Failed to generate itinerary:", error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// Allocation only: distributes a pooled wishlist across N days without
// geocoding or routing anything. The user still generates each day's real
// itinerary one at a time via POST /api/itinerary, same as manual planning.
app.post("/api/itinerary/allocate-days", async (req, res) => {
  if (USE_MOCK) {
    const body = req.body as Partial<AllocateDaysRequest>;
    const numberOfDays =
      Number.isInteger(body?.numberOfDays) && (body!.numberOfDays as number) > 0
        ? (body!.numberOfDays as number)
        : 3;
    const startDate = body?.startDate ?? new Date().toISOString().slice(0, 10);
    const places = body?.places ?? [];

    const emptyBucket = (): DayAllocation => ({
      breakfast: [],
      lunch: [],
      dinner: [],
      primaryActivities: [],
      secondaryActivities: [],
      lateNightActivities: [],
    });
    const buckets: DayAllocation[] = Array.from({ length: numberOfDays }, emptyBucket);
    places.forEach((place, i) => {
      buckets[i % numberOfDays][place.category]?.push(place.name);
    });

    res.json({
      days: buckets.map((data, i) => ({ date: addDays(startDate, i), data })),
    });
    return;
  }

  const body = req.body as AllocateDaysRequest;
  const { trip, numberOfDays, startDate, places, reservations } = body ?? {};
  if (!trip?.country || !trip?.city || !trip?.startingLocation || !startDate) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }
  if (!Number.isInteger(numberOfDays) || numberOfDays < 1 || numberOfDays > 14) {
    res.status(400).json({ error: "numberOfDays must be an integer between 1 and 14" });
    return;
  }
  if (!places?.length && !reservations?.length) {
    res.status(400).json({ error: "At least one place or reservation is required" });
    return;
  }

  const countryLabel = COUNTRY_LABELS[trip.country];
  const tripDates = Array.from({ length: numberOfDays }, (_, i) => addDays(startDate, i));

  for (const reservation of reservations ?? []) {
    if (!tripDates.includes(reservation.date)) {
      res.status(400).json({
        error: `Reservation "${reservation.name}" is dated ${reservation.date}, which falls outside the trip (${tripDates[0]} to ${tripDates[tripDates.length - 1]})`,
      });
      return;
    }
  }

  const bucketedPlaces: Record<PlaceCategory, string[]> = {
    breakfast: [],
    lunch: [],
    dinner: [],
    primaryActivities: [],
    secondaryActivities: [],
    lateNightActivities: [],
  };
  for (const place of places ?? []) {
    bucketedPlaces[place.category]?.push(place.name);
  }

  const reservationSummary = tripDates.map((date) => ({
    date,
    reservations: (reservations ?? [])
      .filter((r) => r.date === date)
      .map((r) => ({ name: r.name, time: formatTime(r.time) })),
  }));

  const data = {
    numberOfDays,
    days: tripDates,
    city: trip.city,
    country: countryLabel,
    reservationSummary,
    data: bucketedPlaces,
  };

  try {
    const prompt = `You are an itinerary planner assistant helping distribute a pool of places across a multi-day trip. The user will provide:
    - numberOfDays: how many days to plan
    - days: the actual calendar date for each day, in order
    - city, country: the trip is entirely within this city
    - reservationSummary: for each date, any reservations the user already has locked in (name + time) - these are NOT yours to place, they're just context
    - data: A pooled JSON object with the following fields (NOT yet assigned to any day):
      - breakfast, lunch, dinner: meal spots they want to visit at some point during the trip.
      - primaryActivities: primary activities they want to do.
      - secondaryActivities: secondary places to visit if convenient.
      - lateNightActivities: activities they want to do after dinner.

    Rules to follow:
    1. Distribute every place in "data" across the "numberOfDays" days. A place may appear on AT MOST one day - never repeat a place across two days.
    2. Spread meal-category places (breakfast/lunch/dinner) evenly across days where there are enough of them, rather than piling them onto one day.
    3. Balance the number of activities across days. If a day already has reservations (see reservationSummary), assign it fewer additional places so it isn't overloaded.
    4. Do your best to place every item somewhere. Only leave an item out entirely if it truly can't fit anywhere across the whole trip.
    5. Return exactly "numberOfDays" entries in "days", in chronological order (the first entry is day 1). Do not invent places that aren't in "data".

    ${JSON.stringify(data)}`;

    const parsed = await generateStructured(prompt, allocateDaysResponseSchema);
    const allocatedDays: Partial<DayAllocation>[] = parsed?.days ?? [];
    if (allocatedDays.length === 0) {
      res.status(502).json({ error: "The AI returned no days", allocation: parsed });
      return;
    }

    res.json({
      days: allocatedDays.map((dayAllocation, i) => ({
        date: tripDates[i] ?? addDays(startDate, i),
        data: {
          breakfast: dayAllocation.breakfast ?? [],
          lunch: dayAllocation.lunch ?? [],
          dinner: dayAllocation.dinner ?? [],
          primaryActivities: dayAllocation.primaryActivities ?? [],
          secondaryActivities: dayAllocation.secondaryActivities ?? [],
          lateNightActivities: dayAllocation.lateNightActivities ?? [],
        },
      })),
    });
  } catch (error) {
    console.error("Failed to allocate days:", error);
    res.status(500).json({ error: (error as Error).message });
  }
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
