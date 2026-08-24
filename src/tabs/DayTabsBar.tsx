import type { DayState } from "../types";

export const DayTabsBar = ({
  days,
  selectedDayId,
  onSelect,
  onAdd,
  onRemove,
}: {
  days: DayState[];
  selectedDayId: string | null;
  onSelect: (dayId: string) => void;
  onAdd: () => void;
  onRemove: (dayId: string) => void;
}) => {
  return (
    <div className="flex items-center gap-1 border-b border-gray-200 bg-gray-50 px-2">
      {days.map((day, i) => (
        <div
          key={day.id}
          className={`group flex items-center gap-2 rounded-t-md px-3 py-2 text-sm ${
            day.id === selectedDayId
              ? "border border-b-0 border-gray-200 bg-white font-medium"
              : "text-gray-500 hover:bg-gray-100"
          }`}
        >
          <button onClick={() => onSelect(day.id)}>
            Day {i + 1}
            {day.generation.status === "loaded" && " ✓"}
            {day.generation.status === "loading" && " …"}
          </button>
          {days.length > 1 && (
            <button
              onClick={() => onRemove(day.id)}
              className="text-gray-400 opacity-0 hover:text-gray-700 group-hover:opacity-100"
              aria-label={`Remove Day ${i + 1}`}
            >
              ×
            </button>
          )}
        </div>
      ))}
      <button onClick={onAdd} className="px-3 py-2 text-sm text-blue-600 hover:text-blue-800">
        + Add Day
      </button>
    </div>
  );
};
