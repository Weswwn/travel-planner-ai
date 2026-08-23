// server/server.js
import express from "express";
import dotenv from "dotenv";
dotenv.config({ path: `.env.${process.env.NODE_ENV}` });
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import morgan from "morgan";
import { getAI } from "./gemini";
import cors from "cors";
import { Type } from "@google/genai";

const app = express();
const port = process.env.PORT || 3001;

// Set MOCK_ITINERARY=true to skip the real Gemini + OpenRouteService calls
// (both are rate-limited on the free tier) and replay a captured response
// while iterating on the frontend.
const USE_MOCK = process.env.MOCK_ITINERARY === "true";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mockResponse = USE_MOCK
  ? JSON.parse(fs.readFileSync(path.join(__dirname, "mock-response.json"), "utf-8"))
  : null;

const ai = getAI();

app.use(morgan("dev"));
app.use(
  cors({
    origin: ["http://localhost:3001", "http://localhost:5173"],
  }),
);
app.use(express.json());

const ORS_API_KEY = process.env.OPENROUTESERVICE_API_KEY as string;

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
const geocode = async (address: string): Promise<[number, number]> => {
  const params = new URLSearchParams({
    api_key: ORS_API_KEY,
    text: address,
    size: "1",
  });
  const response = await fetch(
    `https://api.openrouteservice.org/geocode/search?${params.toString()}`,
  );
  const data = await response.json();
  console.log('geocode data response:', data)
  const coordinates = data?.features?.[0]?.geometry?.coordinates;
  if (!coordinates) {
    throw new Error(`Could not geocode address: "${address}"`);
  }
  return coordinates;
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

const itineraryResponseSchema = {
  type: Type.OBJECT,
  properties: {
    route: {
      description: "The places to visit, in the order of the most efficient route",
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          placeName: { type: Type.STRING },
          address: {
            type: Type.STRING,
            description: "The exact address to use for routing, taken from the input data",
          },
          category: { type: Type.STRING },
          arrivalTime: { type: Type.STRING },
          timeAtLocation: { type: Type.STRING },
          travelTimeFromPrevious: { type: Type.STRING },
          notes: {
            type: Type.STRING,
            description: "e.g. reservation needed, hours of operation, why it was skipped",
          },
        },
        required: ["placeName", "address", "category", "arrivalTime", "travelTimeFromPrevious"],
      },
    },
    metadata: {
      type: Type.OBJECT,
      properties: {
        estimatedTotalTime: { type: Type.STRING },
        estimatedTotalDistance: { type: Type.STRING },
      },
    },
    relevantInformation: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
  },
  required: ["route"],
};

app.get("/", async (_req, res) => {
  if (USE_MOCK) {
    res.json(mockResponse);
    return;
  }

  const startingLocation = "750 Kearny St, San Francisco, CA 94108";
  const data = {
    startingLocation,
    date: "12-01-2025",
    data: {
      breakfast: ["3282 Mission St, San Francisco, CA 94110 - Four Chairs"],
      primaryActivities: [
        "Alcatraz Island",
        "Golden Gate Bridge",
        "San Francisco Museum of Modern Art",
      ],
      lunch: ["1555 Folsom St, San Francisco, CA 94103 - Spark Social"],
      dinner: [
        "1906 Van Ness Ave, San Francisco, CA 94109 - House of Prime Rib",
      ],
      lateNightActivities: [
        "1720 Polk St, San Francisco, CA 94133 - Bob's Donuts",
        "1900 Fillmore St, San Francisco, CA 94115 - The Alchemist",
      ],
      secondaryActivities: [
        "2180 Chestnut St, San Francisco, CA 94123 - Chinatown",
        "3555 A St, San Francisco, CA 94133 - Fisherman's Wharf",
        "3355 16th St, San Francisco, CA 94103 - Mission Dolores Park",
      ],
    },
  };

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `You are an itinerary planner assistant. The user will provide the following information:
    - startingLocation: usually where they will be staying i.e, hotel, AirBnB, etc...
    - date: the date of the plan
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
    4. For each place, set "address" to a string that Google Maps can geocode: if the input entry includes a street address, copy it verbatim (do not paraphrase or invent one); if the input entry is just a landmark/place name with no address (e.g. "Alcatraz Island"), use that name as-is since well-known landmarks resolve without a street address.
    5. For each place, add any relevant notes that would help the user, e.g. hours of operation, whether reservations are required.

    ${JSON.stringify(data)}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: itineraryResponseSchema,
      },
    });

    const itinerary = JSON.parse(response.text ?? "{}");
    const route: { placeName: string; address: string }[] = itinerary?.route ?? [];
    if (route.length === 0) {
      res.status(502).json({ error: "Gemini returned an empty route", itinerary });
      return;
    }

    const addresses = [
      startingLocation,
      ...route.map((place) => place.address),
      startingLocation,
    ];
    const labels = ["Start", ...route.map((place) => place.placeName), "Start"];

    // Geocode sequentially to stay well within OpenRouteService's free-tier rate limit.
    const geocoded: [number, number][] = [];
    for (const address of addresses) {
      geocoded.push(await geocode(address));
    }

    // Drop any stop whose geocode landed implausibly far from the starting point
    // (a mis-geocoded ambiguous place name) before it can blow up route distance.
    const MAX_STOP_DISTANCE_KM = 100;
    const startCoordinate = geocoded[0];
    const misgeocodedStops: string[] = [];
    const coordinates: [number, number][] = [];
    const filteredLabels: string[] = [];
    geocoded.forEach((coordinate, i) => {
      if (haversineKm(startCoordinate, coordinate) > MAX_STOP_DISTANCE_KM) {
        misgeocodedStops.push(labels[i]);
        return;
      }
      coordinates.push(coordinate);
      filteredLabels.push(labels[i]);
    });

    const {
      directions,
      coordinates: routedCoordinates,
      labels: routedLabels,
      omittedStops,
    } = await calculateRouteDroppingUnroutableStops(coordinates, filteredLabels);
    const feature = directions.features[0];

    res.json({
      itinerary,
      route: {
        geometry: feature.geometry.coordinates.map(([lng, lat]: [number, number]) => [lat, lng]),
        stops: routedCoordinates.map(([lng, lat], i) => ({ lat, lng, label: routedLabels[i] })),
        summary: feature.properties.summary,
        omittedStops: [...misgeocodedStops, ...omittedStops],
      },
    });
  } catch (error) {
    console.error("Failed to generate itinerary:", error);
    res.status(500).json({ error: (error as Error).message });
  }
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
