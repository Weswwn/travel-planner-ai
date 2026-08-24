import { useState } from "react";

export const AdminPanel = ({
  optimizeRoute,
  onChange,
}: {
  optimizeRoute: boolean;
  onChange: (value: boolean) => void;
}) => {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ position: "fixed", bottom: 12, right: 12, zIndex: 2000 }}>
      {open && (
        <div
          style={{
            marginBottom: 8,
            width: 260,
            background: "white",
            border: "1px solid #ddd",
            borderRadius: 8,
            padding: 12,
            boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
            fontSize: 13,
          }}
        >
          <label style={{ display: "flex", alignItems: "flex-start", gap: 8, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={optimizeRoute}
              onChange={(e) => onChange(e.target.checked)}
              style={{ marginTop: 3 }}
            />
            <span>
              Optimize routes for shortest drive distance
              <div style={{ color: "#888", marginTop: 2 }}>
                Uses OpenRouteService's Optimization API. Reservations keep their scheduled
                position — only the stops around them get reordered for distance.
              </div>
            </span>
          </label>
        </div>
      )}
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          borderRadius: "50%",
          width: 36,
          height: 36,
          border: "1px solid #ccc",
          background: "white",
          cursor: "pointer",
          boxShadow: "0 1px 4px rgba(0,0,0,0.15)",
        }}
        aria-label="Admin settings"
        title="Admin settings"
      >
        ⚙
      </button>
    </div>
  );
};
