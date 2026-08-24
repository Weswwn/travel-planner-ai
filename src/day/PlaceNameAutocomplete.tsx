import { useEffect, useRef, useState } from "react";
import { autocompletePlaces } from "../api/autocompletePlaces";
import type { PlaceSuggestion } from "../types";

export const PlaceNameAutocomplete = ({
  value,
  onChange,
  onSelect,
  country,
  city,
  placeholder,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  onSelect: (suggestion: PlaceSuggestion) => void;
  country: "US" | "CA" | null;
  city: string;
  placeholder?: string;
  className?: string;
}) => {
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const requestId = useRef(0);

  useEffect(() => {
    if (!country || !city || value.trim().length < 3) {
      return;
    }
    const id = ++requestId.current;
    const timeout = setTimeout(async () => {
      const { suggestions: results } = await autocompletePlaces({ q: value, country, city });
      if (id === requestId.current) {
        setSuggestions(results);
        setOpen(results.length > 0);
      }
    }, 400);
    return () => clearTimeout(timeout);
  }, [value, country, city]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} style={{ position: "relative", flex: 1 }}>
      <input
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(false);
        }}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        placeholder={placeholder}
        className={className}
        style={{ width: "100%" }}
      />
      {open && (
        <ul
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            zIndex: 1000,
            background: "white",
            border: "1px solid #ddd",
            borderRadius: 6,
            marginTop: 2,
            maxHeight: 200,
            overflowY: "auto",
            listStyle: "none",
            padding: 0,
            boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
          }}
        >
          {suggestions.map((s, i) => (
            <li key={i}>
              <button
                type="button"
                onClick={() => {
                  onSelect(s);
                  setOpen(false);
                }}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: "6px 10px",
                  border: "none",
                  background: "none",
                  cursor: "pointer",
                  fontSize: 13,
                }}
                onMouseDown={(e) => e.preventDefault()}
              >
                <div style={{ fontWeight: 600 }}>{s.name}</div>
                <div style={{ color: "#888", fontSize: 12 }}>{s.address}</div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
