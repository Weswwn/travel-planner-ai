import { useState } from "react";
import { generateItinerary } from "../api/generateItinerary";
import { allocateDays as allocateDaysApi } from "../api/allocateDays";
import type {
  AutoPlanGeneration,
  AutoPlanPool,
  ConsideredPlace,
  DayInput,
  DayState,
  PlaceCategory,
  Reservation,
  TripInfo,
} from "../types";

const makeId = () => Math.random().toString(36).slice(2);

const OPTIMIZE_ROUTE_STORAGE_KEY = "optimizeRoute";
const readStoredOptimizeRoute = () => {
  try {
    return localStorage.getItem(OPTIMIZE_ROUTE_STORAGE_KEY) !== "false";
  } catch {
    return true;
  }
};

const emptyDayInput = (): DayInput => ({
  date: new Date().toISOString().slice(0, 10),
  reservations: [],
  places: [],
});

const makeDay = (input: DayInput = emptyDayInput()): DayState => ({
  id: makeId(),
  input,
  generation: { status: "idle" },
});

export const usePlannerState = () => {
  const [tripInfo, setTripInfoState] = useState<TripInfo | null>(null);
  const [days, setDays] = useState<DayState[]>([]);
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null);
  const [planningMode, setPlanningMode] = useState<"manual" | "auto" | null>(null);
  const [autoPlanPool, setAutoPlanPool] = useState<AutoPlanPool | null>(null);
  const [autoPlanGeneration, setAutoPlanGeneration] = useState<AutoPlanGeneration>({
    status: "idle",
  });
  const [optimizeRoute, setOptimizeRouteState] = useState(readStoredOptimizeRoute);

  const setOptimizeRoute = (value: boolean) => {
    setOptimizeRouteState(value);
    try {
      localStorage.setItem(OPTIMIZE_ROUTE_STORAGE_KEY, String(value));
    } catch {
      // Ignore - e.g. private browsing mode. The toggle still works for this session.
    }
  };

  // First-time completion: sets trip info only. Day-planning starts separately
  // via startDayByDayPlanning() or a successful allocateDays().
  const completeWizard = (trip: TripInfo) => {
    setTripInfoState(trip);
  };

  // Editing trip info after days already exist: leaves days/selection untouched.
  const updateTripInfo = (trip: TripInfo) => {
    setTripInfoState(trip);
  };

  const startDayByDayPlanning = () => {
    const firstDay = makeDay();
    setDays([firstDay]);
    setSelectedDayId(firstDay.id);
    setPlanningMode("manual");
  };

  const addDay = () => {
    const day = makeDay();
    setDays((prev) => [...prev, day]);
    setSelectedDayId(day.id);
  };

  const removeDay = (dayId: string) => {
    setDays((prev) => {
      if (prev.length <= 1) return prev;
      const next = prev.filter((d) => d.id !== dayId);
      if (selectedDayId === dayId) setSelectedDayId(next[0].id);
      return next;
    });
  };

  const selectDay = (dayId: string) => setSelectedDayId(dayId);

  const updateDayInput = (dayId: string, patch: Partial<DayInput>) => {
    setDays((prev) =>
      prev.map((d) => (d.id === dayId ? { ...d, input: { ...d.input, ...patch } } : d)),
    );
  };

  const addReservation = (dayId: string, reservation: Omit<Reservation, "id">) => {
    setDays((prev) =>
      prev.map((d) =>
        d.id === dayId
          ? {
              ...d,
              input: {
                ...d.input,
                reservations: [...d.input.reservations, { ...reservation, id: makeId() }],
              },
            }
          : d,
      ),
    );
  };

  const removeReservation = (dayId: string, reservationId: string) => {
    setDays((prev) =>
      prev.map((d) =>
        d.id === dayId
          ? {
              ...d,
              input: {
                ...d.input,
                reservations: d.input.reservations.filter((r) => r.id !== reservationId),
              },
            }
          : d,
      ),
    );
  };

  const addPlace = (dayId: string, place: Omit<ConsideredPlace, "id">) => {
    setDays((prev) =>
      prev.map((d) =>
        d.id === dayId
          ? {
              ...d,
              input: {
                ...d.input,
                places: [...d.input.places, { ...place, id: makeId() }],
              },
            }
          : d,
      ),
    );
  };

  const removePlace = (dayId: string, placeId: string) => {
    setDays((prev) =>
      prev.map((d) =>
        d.id === dayId
          ? { ...d, input: { ...d.input, places: d.input.places.filter((p) => p.id !== placeId) } }
          : d,
      ),
    );
  };

  const setGeneration = (dayId: string, generation: DayState["generation"]) => {
    setDays((prev) => prev.map((d) => (d.id === dayId ? { ...d, generation } : d)));
  };

  // Goes back to editing a day's inputs after it's already generated. The
  // reservations/places entered are untouched (they live in `input`, separate
  // from `generation`) - this just re-shows the form instead of the result.
  const editDay = (dayId: string) => setGeneration(dayId, { status: "idle" });

  const generateDay = async (dayId: string) => {
    if (!tripInfo) return;
    const day = days.find((d) => d.id === dayId);
    if (!day) return;

    setGeneration(dayId, { status: "loading" });
    try {
      const { itinerary, route } = await generateItinerary({
        trip: tripInfo,
        day: {
          date: day.input.date,
          reservations: day.input.reservations.map(({ name, time, notes, address, lat, lng }) => ({
            name,
            time,
            notes,
            address,
            lat,
            lng,
          })),
          places: day.input.places.map(({ name, category, address, lat, lng }) => ({
            name,
            category,
            address,
            lat,
            lng,
          })),
        },
        optimizeRoute,
      });
      // `dayId` may have been removed while the request was in flight; the
      // map() below is then a no-op against the current `days` array, which
      // is the desired (harmless) outcome rather than an error.
      setGeneration(dayId, { status: "loaded", itinerary, route });
    } catch (err) {
      setGeneration(dayId, {
        status: "error",
        message: err instanceof Error ? err.message : "Something went wrong",
      });
    }
  };

  // `pooledPlaces`/`pooledReservations` are the original wishlist the user
  // built in AutoPlanWizard - the allocation response only echoes back bare
  // names per day, so any verified address/lat/lng (from autocomplete) has to
  // be recovered by matching back against the original pool, not re-derived.
  const seedDaysFromAllocation = (
    allocation: { date: string; data: Record<PlaceCategory, string[]> }[],
    pooledPlaces: ConsideredPlace[],
    pooledReservations: Reservation[],
  ) => {
    const newDays: DayState[] = allocation.map(({ date, data }) => {
      const places: ConsideredPlace[] = (Object.keys(data) as PlaceCategory[]).flatMap(
        (category) =>
          data[category].map((name) => {
            const pooled = pooledPlaces.find((p) => p.name === name);
            return {
              id: makeId(),
              name,
              category,
              address: pooled?.address,
              lat: pooled?.lat,
              lng: pooled?.lng,
            };
          }),
      );
      const reservations: Reservation[] = pooledReservations
        .filter((r) => r.date === date)
        .map(({ name, time, notes, address, lat, lng }) => ({
          id: makeId(),
          name,
          time,
          notes,
          address,
          lat,
          lng,
        }));

      return makeDay({ date, places, reservations });
    });
    setDays(newDays);
    setSelectedDayId(newDays[0]?.id ?? null);
  };

  const allocateDays = async (params: {
    numberOfDays: number;
    startDate: string;
    places: ConsideredPlace[];
    reservations: Reservation[];
  }) => {
    if (!tripInfo) return;
    setAutoPlanGeneration({ status: "loading" });
    try {
      const response = await allocateDaysApi({
        trip: tripInfo,
        numberOfDays: params.numberOfDays,
        startDate: params.startDate,
        places: params.places.map(({ name, category }) => ({ name, category })),
        reservations: params.reservations.map(({ name, time, notes, date }) => ({
          name,
          time,
          notes,
          date: date ?? "",
        })),
      });
      setAutoPlanPool(params);
      setPlanningMode("auto");
      seedDaysFromAllocation(response.days, params.places, params.reservations);
      setAutoPlanGeneration({ status: "idle" });
    } catch (err) {
      setAutoPlanGeneration({
        status: "error",
        message: err instanceof Error ? err.message : "Something went wrong",
      });
    }
  };

  const redoAutoPlan = () => {
    setDays([]);
    setSelectedDayId(null);
  };

  return {
    tripInfo,
    completeWizard,
    updateTripInfo,
    days,
    selectedDayId,
    planningMode,
    autoPlanPool,
    autoPlanGeneration,
    optimizeRoute,
    setOptimizeRoute,
    startDayByDayPlanning,
    addDay,
    removeDay,
    selectDay,
    updateDayInput,
    addReservation,
    removeReservation,
    addPlace,
    removePlace,
    generateDay,
    editDay,
    allocateDays,
    redoAutoPlan,
  };
};

export type PlannerState = ReturnType<typeof usePlannerState>;
