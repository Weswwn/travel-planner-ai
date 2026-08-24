import { useState, type ReactNode } from "react";
import "./App.css";
import { usePlannerState } from "./planner/usePlannerState";
import { TripSetupWizard } from "./wizard/TripSetupWizard";
import { PlanModeChoice } from "./wizard/PlanModeChoice";
import { AutoPlanWizard } from "./wizard/AutoPlanWizard";
import { AdminPanel } from "./wizard/AdminPanel";
import { DayTabsBar } from "./tabs/DayTabsBar";
import { DayPanel } from "./day/DayPanel";

function App() {
  const planner = usePlannerState();
  const [editingTrip, setEditingTrip] = useState(false);
  const [planMode, setPlanMode] = useState<"choice" | "auto">("choice");

  const handleRedoAutoPlan = () => {
    if (
      window.confirm(
        "This will discard your current day tabs, including any already-generated itineraries. Continue?",
      )
    ) {
      planner.redoAutoPlan();
      setPlanMode("auto");
    }
  };

  let content: ReactNode;

  if (!planner.tripInfo) {
    content = <TripSetupWizard onComplete={planner.completeWizard} />;
  } else if (editingTrip) {
    content = (
      <TripSetupWizard
        initialValues={planner.tripInfo}
        onComplete={(trip) => {
          planner.updateTripInfo(trip);
          setEditingTrip(false);
        }}
        onCancel={() => setEditingTrip(false)}
      />
    );
  } else if (planner.days.length === 0) {
    content =
      planMode === "auto" ? (
        <AutoPlanWizard
          trip={planner.tripInfo}
          generation={planner.autoPlanGeneration}
          onGenerate={planner.allocateDays}
          onBack={() => setPlanMode("choice")}
          initialPool={planner.autoPlanPool ?? undefined}
        />
      ) : (
        <PlanModeChoice
          onChooseManual={planner.startDayByDayPlanning}
          onChooseAuto={() => setPlanMode("auto")}
        />
      );
  } else {
    const day = planner.days.find((d) => d.id === planner.selectedDayId);
    content = (
      <div style={{ display: "flex", flexDirection: "column", height: "100vh", width: "100vw" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "#f9fafb",
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <DayTabsBar
              days={planner.days}
              selectedDayId={planner.selectedDayId}
              onSelect={planner.selectDay}
              onAdd={planner.addDay}
              onRemove={planner.removeDay}
            />
          </div>
          <div style={{ display: "flex", gap: 12, marginRight: 12 }}>
            {planner.planningMode === "auto" && (
              <button
                onClick={handleRedoAutoPlan}
                style={{
                  fontSize: 13,
                  color: "#2563eb",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Redo AI planning
              </button>
            )}
            <button
              onClick={() => setEditingTrip(true)}
              style={{
                fontSize: 13,
                color: "#2563eb",
                background: "none",
                border: "none",
                cursor: "pointer",
              }}
            >
              Edit trip details
            </button>
          </div>
        </div>
        {day && (
          <div style={{ flex: 1, minHeight: 0 }}>
            <DayPanel day={day} planner={planner} />
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      {content}
      <AdminPanel optimizeRoute={planner.optimizeRoute} onChange={planner.setOptimizeRoute} />
    </>
  );
}

export default App;
