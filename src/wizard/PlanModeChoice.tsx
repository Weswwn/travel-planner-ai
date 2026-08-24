export const PlanModeChoice = ({
  onChooseManual,
  onChooseAuto,
}: {
  onChooseManual: () => void;
  onChooseAuto: () => void;
}) => {
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-lg rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="mb-6 text-xl font-semibold">How would you like to plan?</h1>
        <div className="flex flex-col gap-3">
          <button
            onClick={onChooseManual}
            className="rounded-md border border-gray-300 p-4 text-left hover:border-blue-600 hover:bg-blue-50"
          >
            <div className="font-medium">Plan day-by-day myself</div>
            <div className="mt-1 text-sm text-gray-500">
              Add reservations and places for each day, one at a time.
            </div>
          </button>
          <button
            onClick={onChooseAuto}
            className="rounded-md border border-gray-300 p-4 text-left hover:border-blue-600 hover:bg-blue-50"
          >
            <div className="font-medium">Let AI plan your whole trip</div>
            <div className="mt-1 text-sm text-gray-500">
              Tell us how many days and what you want to do — we'll spread it across your
              trip for you.
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};
