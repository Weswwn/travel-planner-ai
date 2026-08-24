// Keep in sync with server/types.ts

export type PlaceCategory =
  | "breakfast"
  | "lunch"
  | "dinner"
  | "primaryActivities"
  | "secondaryActivities"
  | "lateNightActivities";

export type TripInfo = {
  country: "US" | "CA";
  city: string;
  startingLocation: string;
  // Set when the starting location was picked from the autocomplete dropdown.
  startingLocationLat?: number;
  startingLocationLng?: number;
};

// address/lat/lng are set only when picked from the autocomplete dropdown
// (PlaceNameAutocomplete) rather than free-typed - see usePlannerState.ts.
export type Reservation = {
  id: string;
  name: string;
  time: string; // "HH:MM", 24-hour
  notes?: string;
  date?: string; // "YYYY-MM-DD", only used when collected via the auto-plan pooled wishlist
  address?: string;
  lat?: number;
  lng?: number;
};

export type ConsideredPlace = {
  id: string;
  name: string;
  category: PlaceCategory;
  address?: string;
  lat?: number;
  lng?: number;
};

export type PlaceSuggestion = { name: string; address: string; lat: number; lng: number };

export type PlacesAutocompleteResponse = { suggestions: PlaceSuggestion[] };

export type DayInput = {
  date: string; // "YYYY-MM-DD"
  reservations: Reservation[];
  places: ConsideredPlace[];
};

export type ItineraryStop = {
  placeName: string;
  address: string;
  category?: string;
  arrivalTime?: string;
  timeAtLocation?: string;
  travelTimeFromPrevious?: string;
  notes?: string;
};

export type Itinerary = {
  route: ItineraryStop[];
  metadata?: { estimatedTotalTime?: string; estimatedTotalDistance?: string };
  relevantInformation?: string[];
};

export type MapStop = {
  lat: number;
  lng: number;
  label: string;
};

export type RouteData = {
  geometry: [number, number][];
  stops: MapStop[];
  summary: { distance: number; duration: number };
  omittedStops: string[];
};

export type DayGeneration =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "loaded"; itinerary: Itinerary; route: RouteData };

export type DayState = {
  id: string;
  input: DayInput;
  generation: DayGeneration;
};

export type GenerateItineraryRequest = {
  trip: TripInfo;
  day: {
    date: string;
    reservations: {
      name: string;
      time: string;
      notes?: string;
      address?: string;
      lat?: number;
      lng?: number;
    }[];
    places: {
      name: string;
      category: PlaceCategory;
      address?: string;
      lat?: number;
      lng?: number;
    }[];
  };
  optimizeRoute?: boolean;
};

export type GenerateItineraryResponse = {
  itinerary: Itinerary;
  route: RouteData;
};

export type DayAllocation = {
  breakfast: string[];
  lunch: string[];
  dinner: string[];
  primaryActivities: string[];
  secondaryActivities: string[];
  lateNightActivities: string[];
};

export type AllocateDaysRequest = {
  trip: TripInfo;
  numberOfDays: number;
  startDate: string;
  places: { name: string; category: PlaceCategory }[];
  reservations: { name: string; date: string; time: string; notes?: string }[];
};

export type AllocateDaysResponse = {
  days: { date: string; data: DayAllocation }[];
};

export type AutoPlanGeneration =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string };

export type AutoPlanPool = {
  numberOfDays: number;
  startDate: string;
  places: ConsideredPlace[];
  reservations: Reservation[];
};
