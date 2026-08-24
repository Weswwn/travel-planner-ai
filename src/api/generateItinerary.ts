import type { GenerateItineraryRequest, GenerateItineraryResponse } from "../types";

export const generateItinerary = async (
  request: GenerateItineraryRequest,
): Promise<GenerateItineraryResponse> => {
  const response = await fetch("http://localhost:3001/api/itinerary", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error ?? "Failed to generate itinerary");
  }
  return data;
};
