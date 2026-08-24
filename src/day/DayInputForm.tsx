import type { ConsideredPlace, DayState, Reservation, TripInfo } from "../types";
import { ReservationsInput } from "./ReservationsInput";
import { PlacesInput } from "./PlacesInput";

export const DayInputForm = ({
  day,
  trip,
  onDateChange,
  onAddReservation,
  onRemoveReservation,
  onAddPlace,
  onRemovePlace,
  onGenerate,
}: {
  day: DayState;
  trip: TripInfo;
  onDateChange: (date: string) => void;
  onAddReservation: (reservation: Omit<Reservation, "id">) => void;
  onRemoveReservation: (reservationId: string) => void;
  onAddPlace: (place: Omit<ConsideredPlace, "id">) => void;
  onRemovePlace: (placeId: string) => void;
  onGenerate: () => void;
}) => {
  const isLoading = day.generation.status === "loading";
  const hasAnyInput = day.input.reservations.length > 0 || day.input.places.length > 0;

  return (
    <div className="mx-auto max-w-lg p-6">
      {day.generation.status === "error" && (
        <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {day.generation.message}
        </p>
      )}

      <label className="mb-4 block text-sm">
        <span className="mb-1 block font-semibold text-gray-700">Date</span>
        <input
          type="date"
          value={day.input.date}
          onChange={(e) => onDateChange(e.target.value)}
          className="rounded-md border border-gray-300 px-2 py-1"
        />
      </label>

      <div className="mb-6">
        <ReservationsInput
          reservations={day.input.reservations}
          onAdd={onAddReservation}
          onRemove={onRemoveReservation}
          trip={trip}
        />
      </div>

      <div className="mb-6">
        <PlacesInput
          places={day.input.places}
          onAdd={onAddPlace}
          onRemove={onRemovePlace}
          trip={trip}
        />
      </div>

      <button
        onClick={onGenerate}
        disabled={isLoading || !hasAnyInput}
        className="w-full rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-40"
      >
        {isLoading ? "Generating..." : "Generate Itinerary"}
      </button>
    </div>
  );
};
