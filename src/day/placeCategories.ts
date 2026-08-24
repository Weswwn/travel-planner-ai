import type { PlaceCategory } from "../types";

export const PLACE_CATEGORIES: { value: PlaceCategory; label: string }[] = [
  { value: "breakfast", label: "Breakfast" },
  { value: "lunch", label: "Lunch" },
  { value: "dinner", label: "Dinner" },
  { value: "primaryActivities", label: "Primary activity" },
  { value: "secondaryActivities", label: "Secondary activity" },
  { value: "lateNightActivities", label: "Late-night activity" },
];

export const categoryLabel = (category: PlaceCategory): string =>
  PLACE_CATEGORIES.find((c) => c.value === category)?.label ?? category;
