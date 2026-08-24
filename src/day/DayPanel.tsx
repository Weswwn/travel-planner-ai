import type { DayState } from "../types";
import type { PlannerState } from "../planner/usePlannerState";
import { DayInputForm } from "./DayInputForm";
import { DayResultView } from "./DayResultView";

export const DayPanel = ({ day, planner }: { day: DayState; planner: PlannerState }) => {
  if (day.generation.status === "loaded") {
    return (
      <DayResultView
        itinerary={day.generation.itinerary}
        route={day.generation.route}
        onEdit={() => planner.editDay(day.id)}
      />
    );
  }

  return (
    <div style={{ height: "100%", overflowY: "auto" }}>
      <DayInputForm
        day={day}
        trip={planner.tripInfo!}
        onDateChange={(date) => planner.updateDayInput(day.id, { date })}
        onAddReservation={(reservation) => planner.addReservation(day.id, reservation)}
        onRemoveReservation={(reservationId) => planner.removeReservation(day.id, reservationId)}
        onAddPlace={(place) => planner.addPlace(day.id, place)}
        onRemovePlace={(placeId) => planner.removePlace(day.id, placeId)}
        onGenerate={() => planner.generateDay(day.id)}
      />
    </div>
  );
};
