import { useState } from "react";
import type { TripInfo } from "../types";
import { PlaceNameAutocomplete } from "../day/PlaceNameAutocomplete";

const STEPS = ["country", "city", "startingLocation", "review"] as const;
type Step = (typeof STEPS)[number];

export const TripSetupWizard = ({
  initialValues,
  onComplete,
  onCancel,
}: {
  initialValues?: TripInfo;
  onComplete: (trip: TripInfo) => void;
  onCancel?: () => void;
}) => {
  const [stepIndex, setStepIndex] = useState(0);
  const [country, setCountry] = useState<TripInfo["country"] | null>(
    initialValues?.country ?? null,
  );
  const [city, setCity] = useState(initialValues?.city ?? "");
  const [startingLocation, setStartingLocation] = useState(initialValues?.startingLocation ?? "");
  const [startingLocationCoords, setStartingLocationCoords] = useState<
    { lat: number; lng: number } | undefined
  >(
    initialValues?.startingLocationLat !== undefined && initialValues?.startingLocationLng !== undefined
      ? { lat: initialValues.startingLocationLat, lng: initialValues.startingLocationLng }
      : undefined,
  );

  const step: Step = STEPS[stepIndex];
  const goNext = () => setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
  const goBack = () => setStepIndex((i) => Math.max(i - 1, 0));

  const canGoNext =
    (step === "country" && country !== null) ||
    (step === "city" && city.trim().length > 0) ||
    (step === "startingLocation" && startingLocation.trim().length > 0);

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
        {onCancel && (
          <div className="mb-2 text-right">
            <button onClick={onCancel} className="text-sm text-gray-400 hover:text-gray-600">
              Cancel
            </button>
          </div>
        )}

        {step === "country" && (
          <div>
            <h1 className="mb-4 text-xl font-semibold">What country are you visiting?</h1>
            <div className="flex flex-col gap-2">
              {(["US", "CA"] as const).map((value) => (
                <button
                  key={value}
                  onClick={() => setCountry(value)}
                  className={`rounded-md border px-4 py-2 text-left ${
                    country === value
                      ? "border-blue-600 bg-blue-50 text-blue-700"
                      : "border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  {value === "US" ? "United States" : "Canada"}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === "city" && (
          <div>
            <h1 className="mb-4 text-xl font-semibold">What city?</h1>
            <input
              autoFocus
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="e.g. San Francisco"
              className="w-full rounded-md border border-gray-300 px-3 py-2"
            />
          </div>
        )}

        {step === "startingLocation" && (
          <div>
            <h1 className="mb-1 text-xl font-semibold">Where are you staying?</h1>
            <p className="mb-4 text-sm text-gray-500">
              Your hotel or Airbnb address — each day's route starts and ends here.
            </p>
            <PlaceNameAutocomplete
              value={startingLocation}
              onChange={(value) => {
                setStartingLocation(value);
                setStartingLocationCoords(undefined);
              }}
              onSelect={(suggestion) => {
                setStartingLocation(suggestion.address);
                setStartingLocationCoords({ lat: suggestion.lat, lng: suggestion.lng });
              }}
              country={country}
              city={city}
              placeholder="e.g. 750 Kearny St, San Francisco, CA 94108"
              className="w-full rounded-md border border-gray-300 px-3 py-2"
            />
          </div>
        )}

        {step === "review" && country && (
          <div>
            <h1 className="mb-4 text-xl font-semibold">Look right?</h1>
            <dl className="mb-6 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">Country</dt>
                <dd className="font-medium">{country === "US" ? "United States" : "Canada"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">City</dt>
                <dd className="font-medium">{city}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="shrink-0 text-gray-500">Starting location</dt>
                <dd className="text-right font-medium">{startingLocation}</dd>
              </div>
            </dl>
          </div>
        )}

        <div className="mt-6 flex justify-between">
          <button
            onClick={goBack}
            disabled={stepIndex === 0}
            className="rounded-md px-4 py-2 text-gray-600 disabled:opacity-0"
          >
            Back
          </button>
          {step === "review" ? (
            <button
              onClick={() =>
                country &&
                onComplete({
                  country,
                  city,
                  startingLocation,
                  startingLocationLat: startingLocationCoords?.lat,
                  startingLocationLng: startingLocationCoords?.lng,
                })
              }
              className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
            >
              {initialValues ? "Save Changes" : "Start Planning"}
            </button>
          ) : (
            <button
              onClick={goNext}
              disabled={!canGoNext}
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
