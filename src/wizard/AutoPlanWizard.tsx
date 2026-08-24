import { useState } from "react";
import type { AutoPlanGeneration, AutoPlanPool, ConsideredPlace, Reservation, TripInfo } from "../types";
import { ReservationsInput } from "../day/ReservationsInput";
import { PlacesInput } from "../day/PlacesInput";

const makeId = () => Math.random().toString(36).slice(2);

// Date inputs report an empty/partial value while the user is still typing
// (e.g. only the month filled in so far), so this must tolerate invalid input
// rather than throwing - it runs on every render, not just after submission.
const addDaysLocal = (dateStr: string, offset: number) => {
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime()) || !Number.isFinite(offset)) return dateStr;
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
};

const STEPS = ["dayCount", "wishlist"] as const;
type Step = (typeof STEPS)[number];

export const AutoPlanWizard = ({
  trip,
  generation,
  onGenerate,
  onBack,
  initialPool,
}: {
  trip: TripInfo;
  generation: AutoPlanGeneration;
  onGenerate: (params: {
    numberOfDays: number;
    startDate: string;
    places: ConsideredPlace[];
    reservations: Reservation[];
  }) => void;
  onBack: () => void;
  initialPool?: AutoPlanPool;
}) => {
  const [stepIndex, setStepIndex] = useState(0);
  const [numberOfDays, setNumberOfDays] = useState(initialPool?.numberOfDays ?? 3);
  const [startDate, setStartDate] = useState(
    initialPool?.startDate ?? new Date().toISOString().slice(0, 10),
  );
  const [places, setPlaces] = useState<ConsideredPlace[]>(initialPool?.places ?? []);
  const [reservations, setReservations] = useState<Reservation[]>(
    initialPool?.reservations ?? [],
  );

  const step: Step = STEPS[stepIndex];
  const isLoading = generation.status === "loading";
  const maxDate = addDaysLocal(startDate, Math.max(numberOfDays - 1, 0));

  const goNext = () => setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
  const goBack = () => (stepIndex === 0 ? onBack() : setStepIndex((i) => i - 1));

  const addPlace = (place: Omit<ConsideredPlace, "id">) =>
    setPlaces((prev) => [...prev, { ...place, id: makeId() }]);
  const removePlace = (id: string) => setPlaces((prev) => prev.filter((p) => p.id !== id));

  const addReservation = (reservation: Omit<Reservation, "id">) =>
    setReservations((prev) => [...prev, { ...reservation, id: makeId() }]);
  const removeReservation = (id: string) =>
    setReservations((prev) => prev.filter((r) => r.id !== id));

  const canGenerate = (places.length > 0 || reservations.length > 0) && !isLoading;

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-lg rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
        {step === "dayCount" && (
          <div>
            <h1 className="mb-4 text-xl font-semibold">How many days is your trip?</h1>
            <label className="mb-4 block text-sm">
              <span className="mb-1 block text-gray-700">Number of days</span>
              <input
                type="number"
                min={1}
                max={14}
                value={numberOfDays}
                onChange={(e) => {
                  const value = Number(e.target.value);
                  setNumberOfDays(Number.isFinite(value) ? value : 0);
                }}
                className="w-24 rounded-md border border-gray-300 px-2 py-1"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-gray-700">Start date</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="rounded-md border border-gray-300 px-2 py-1"
              />
            </label>
          </div>
        )}

        {step === "wishlist" && (
          <div>
            <h1 className="mb-1 text-xl font-semibold">What are you considering?</h1>
            <p className="mb-4 text-sm text-gray-500">
              Add everything you're thinking about across the whole trip — we'll spread it
              across your {numberOfDays} day{numberOfDays === 1 ? "" : "s"}.
            </p>

            {generation.status === "error" && (
              <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                {generation.message}
              </p>
            )}

            <div className="mb-6">
              <ReservationsInput
                reservations={reservations}
                onAdd={addReservation}
                onRemove={removeReservation}
                trip={trip}
                withDate
                minDate={startDate}
                maxDate={maxDate}
              />
            </div>

            <div className="mb-2">
              <PlacesInput places={places} onAdd={addPlace} onRemove={removePlace} trip={trip} />
            </div>
          </div>
        )}

        <div className="mt-6 flex justify-between">
          <button onClick={goBack} className="rounded-md px-4 py-2 text-gray-600">
            Back
          </button>
          {step === "wishlist" ? (
            <button
              onClick={() => onGenerate({ numberOfDays, startDate, places, reservations })}
              disabled={!canGenerate}
              className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-40"
            >
              {isLoading ? `Planning your ${numberOfDays} days…` : "Plan My Days"}
            </button>
          ) : (
            <button
              onClick={goNext}
              disabled={numberOfDays < 1 || numberOfDays > 14 || !startDate}
              className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-40"
            >
              Next
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
