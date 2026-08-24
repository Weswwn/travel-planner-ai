import { useState } from "react";
import type { ConsideredPlace, PlaceCategory, TripInfo } from "../types";
import { PLACE_CATEGORIES, categoryLabel } from "./placeCategories";
import { PlaceNameAutocomplete } from "./PlaceNameAutocomplete";

export const PlacesInput = ({
  places,
  onAdd,
  onRemove,
  trip,
}: {
  places: ConsideredPlace[];
  onAdd: (place: Omit<ConsideredPlace, "id">) => void;
  onRemove: (placeId: string) => void;
  trip: TripInfo;
}) => {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<PlaceCategory>("primaryActivities");
  const [verified, setVerified] = useState<{ address: string; lat: number; lng: number } | null>(
    null,
  );

  const addPlace = () => {
    if (!name.trim()) return;
    onAdd({ name: name.trim(), category, ...(verified ?? {}) });
    setName("");
    setVerified(null);
  };

  const grouped = PLACE_CATEGORIES.map((c) => ({
    category: c,
    places: places.filter((p) => p.category === c.value),
  })).filter((g) => g.places.length > 0);

  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-gray-700">Places you're considering</h3>
      <div className="mb-2 flex gap-2">
        <PlaceNameAutocomplete
          value={name}
          onChange={(value) => {
            setName(value);
            setVerified(null);
          }}
          onSelect={(suggestion) => {
            setName(suggestion.name);
            setVerified(suggestion);
          }}
          country={trip.country}
          city={trip.city}
          placeholder="Place name"
          className="rounded-md border border-gray-300 px-2 py-1 text-sm"
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as PlaceCategory)}
          className="rounded-md border border-gray-300 px-2 py-1 text-sm"
        >
          {PLACE_CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
        <button
          onClick={addPlace}
          disabled={!name.trim()}
          className="rounded-md bg-gray-800 px-3 py-1 text-sm text-white disabled:opacity-40"
        >
          Add
        </button>
      </div>
      {grouped.map((g) => (
        <div key={g.category.value} className="mb-2">
          <div className="text-xs font-medium text-gray-500">{categoryLabel(g.category.value)}</div>
          <ul className="space-y-1">
            {g.places.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between rounded-md bg-gray-50 px-2 py-1 text-sm"
              >
                <span>
                  {p.lat !== undefined && (
                    <span title="Verified location" className="text-green-600">
                      ✓{" "}
                    </span>
                  )}
                  {p.name}
                </span>
                <button
                  onClick={() => onRemove(p.id)}
                  className="text-gray-400 hover:text-gray-700"
                  aria-label={`Remove ${p.name}`}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
};
