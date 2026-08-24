import type { PlacesAutocompleteResponse } from "../types";

export const autocompletePlaces = async (params: {
  q: string;
  country: "US" | "CA";
  city: string;
}): Promise<PlacesAutocompleteResponse> => {
  const query = new URLSearchParams(params);
  const response = await fetch(`http://localhost:3001/api/places/autocomplete?${query}`);
  if (!response.ok) return { suggestions: [] };
  return response.json();
};
