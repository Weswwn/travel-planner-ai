import { useState } from "react";
import type { Reservation, TripInfo } from "../types";
import { PlaceNameAutocomplete } from "./PlaceNameAutocomplete";

export const ReservationsInput = ({
  reservations,
  onAdd,
  onRemove,
  trip,
  withDate,
  minDate,
  maxDate,
}: {
  reservations: Reservation[];
  onAdd: (reservation: Omit<Reservation, "id">) => void;
  onRemove: (reservationId: string) => void;
  trip: TripInfo;
  withDate?: boolean;
  minDate?: string;
  maxDate?: string;
}) => {
  const [name, setName] = useState("");
  const [time, setTime] = useState("");
  const [date, setDate] = useState(minDate ?? "");
  const [notes, setNotes] = useState("");
  const [verified, setVerified] = useState<{ address: string; lat: number; lng: number } | null>(
    null,
  );

  const canAdd = name.trim() && time && (!withDate || date);

  const addReservation = () => {
    if (!canAdd) return;
    onAdd({
      name: name.trim(),
      time,
      notes: notes.trim() || undefined,
      date: withDate ? date : undefined,
      ...(verified ?? {}),
    });
    setName("");
    setTime("");
    setNotes("");
    setVerified(null);
  };

  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-gray-700">
        Reservations you've already made
      </h3>
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
        {withDate && (
          <input
            type="date"
            value={date}
            min={minDate}
            max={maxDate}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-md border border-gray-300 px-2 py-1 text-sm"
          />
        )}
        <input
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          className="rounded-md border border-gray-300 px-2 py-1 text-sm"
        />
      </div>
      <div className="mb-2 flex gap-2">
        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes (optional)"
          className="flex-1 rounded-md border border-gray-300 px-2 py-1 text-sm"
        />
        <button
          onClick={addReservation}
          disabled={!canAdd}
          className="rounded-md bg-gray-800 px-3 py-1 text-sm text-white disabled:opacity-40"
        >
          Add
        </button>
      </div>
      {reservations.length > 0 && (
        <ul className="space-y-1">
          {reservations.map((r) => (
            <li
              key={r.id}
              className="flex items-center justify-between rounded-md bg-gray-50 px-2 py-1 text-sm"
            >
              <span>
                {r.lat !== undefined && (
                  <span title="Verified location" className="text-green-600">
                    ✓{" "}
                  </span>
                )}
                {r.name} {r.date && <span>({r.date}) </span>}@ {r.time}
                {r.notes && <span className="text-gray-500"> — {r.notes}</span>}
              </span>
              <button
                onClick={() => onRemove(r.id)}
                className="text-gray-400 hover:text-gray-700"
                aria-label={`Remove reservation for ${r.name}`}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
