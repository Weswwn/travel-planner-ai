// Keep in sync with src/types.ts

export type PlaceCategory =
  | "breakfast"
  | "lunch"
  | "dinner"
  | "primaryActivities"
  | "secondaryActivities"
  | "lateNightActivities";

export type GenerateItineraryRequest = {
  trip: {
    country: "US" | "CA";
    city: string;
    startingLocation: string;
    // Set when the user picked the starting location from the autocomplete
    // dropdown - lets the backend skip re-geocoding it.
    startingLocationLat?: number;
    startingLocationLng?: number;
  };
  day: {
    date: string;
    // address/lat/lng are set only when the user picked an autocomplete
    // suggestion rather than free-typing a name - when present, the backend
    // trusts them directly instead of asking the LLM to reconstruct an
    // address (which local models in particular are prone to hallucinating).
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
  // Reorders stops for shortest total drive distance via OpenRouteService's
  // Optimization API. Defaults to true (enabled) if omitted. Does NOT account
  // for reservation times when reordering - purely geometric optimization.
  optimizeRoute?: boolean;
};

export type PlaceSuggestion = { name: string; address: string; lat: number; lng: number };

export type PlacesAutocompleteResponse = { suggestions: PlaceSuggestion[] };

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
  trip: { country: "US" | "CA"; city: string; startingLocation: string };
  numberOfDays: number;
  startDate: string;
  places: { name: string; category: PlaceCategory }[];
  reservations: { name: string; date: string; time: string; notes?: string }[];
};

export type AllocateDaysResponse = {
  days: { date: string; data: DayAllocation }[];
};
