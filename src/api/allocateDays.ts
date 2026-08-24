import type { AllocateDaysRequest, AllocateDaysResponse } from "../types";

export const allocateDays = async (
  request: AllocateDaysRequest,
): Promise<AllocateDaysResponse> => {
  const response = await fetch("http://localhost:3001/api/itinerary/allocate-days", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error ?? "Failed to plan days");
  }
  return data;
};
