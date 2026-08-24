import { MapContainer, TileLayer, Marker, Popup, Polyline } from "react-leaflet";
import { useState } from "react";
import { FitBounds } from "../Map";
import { createPinIcon } from "../Map/markerIcon";
import type { Itinerary, MapStop, RouteData } from "../types";

const STOP_COLOR = "#2563eb";
const START_COLOR = "#16a34a";
const HOVER_COLOR = "#dc2626";

// Google's URL-based Directions scheme needs no API key: https://developers.google.com/maps/documentation/urls/get-started
const buildGoogleMapsUrl = (stops: MapStop[]) => {
  if (stops.length < 2) return null;
  const toLatLng = (stop: MapStop) => `${stop.lat},${stop.lng}`;
  const params = new URLSearchParams({
    api: "1",
    origin: toLatLng(stops[0]),
    destination: toLatLng(stops[stops.length - 1]),
    travelmode: "driving",
  });
  const waypoints = stops.slice(1, -1).map(toLatLng).join("|");
  if (waypoints) params.set("waypoints", waypoints);
  return `https://www.google.com/maps/dir/?${params.toString()}`;
};

export const DayResultView = ({
  itinerary,
  route,
  onEdit,
}: {
  itinerary: Itinerary;
  route: RouteData;
  onEdit: () => void;
}) => {
  const [hoveredLabel, setHoveredLabel] = useState<string | null>(null);

  return (
    <div style={{ display: "flex", height: "100%", width: "100%" }}>
      <div
        style={{
          width: 380,
          minWidth: 380,
          height: "100%",
          overflowY: "auto",
          borderRight: "1px solid #ddd",
          padding: 16,
          boxSizing: "border-box",
          textAlign: "left",
        }}
      >
        <button
          onClick={onEdit}
          style={{
            border: "1px solid #ccc",
            borderRadius: 6,
            padding: "6px 10px",
            fontSize: 13,
            background: "white",
            cursor: "pointer",
          }}
        >
          ← Edit this day
        </button>

        {!!route.omittedStops.length && (
          <p style={{ color: "#b8860b", marginTop: 12 }}>
            Not drivable, left off the map: {route.omittedStops.join(", ")}
          </p>
        )}

        <a
          href={buildGoogleMapsUrl(route.stops) ?? undefined}
          target="_blank"
          rel="noopener noreferrer"
          style={{ display: "block", marginTop: 12 }}
        >
          Open this route in Google Maps
        </a>

        <div style={{ marginTop: 16 }}>
          {itinerary.metadata && (
            <p style={{ fontSize: 14, color: "#666" }}>
              {itinerary.metadata.estimatedTotalTime} &middot;{" "}
              {itinerary.metadata.estimatedTotalDistance}
            </p>
          )}

          <ol style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {itinerary.route.map((stop, i) => (
              <li
                key={i}
                onMouseEnter={() => setHoveredLabel(stop.placeName)}
                onMouseLeave={() => setHoveredLabel(null)}
                style={{
                  padding: "10px 0",
                  borderBottom: "1px solid #eee",
                  backgroundColor: hoveredLabel === stop.placeName ? "#fdecea" : "transparent",
                  cursor: "default",
                }}
              >
                <div style={{ fontWeight: 600 }}>
                  {i + 1}. {stop.placeName}
                </div>
                {stop.category && (
                  <div style={{ fontSize: 12, color: "#888" }}>{stop.category}</div>
                )}
                <div style={{ fontSize: 13, color: "#444" }}>
                  {[stop.travelTimeFromPrevious, stop.arrivalTime, stop.timeAtLocation]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
                {stop.notes && (
                  <div style={{ fontSize: 13, color: "#666", marginTop: 4 }}>{stop.notes}</div>
                )}
              </li>
            ))}
          </ol>

          {!!itinerary.relevantInformation?.length && (
            <ul style={{ fontSize: 12, color: "#888", marginTop: 12 }}>
              {itinerary.relevantInformation.map((note, i) => (
                <li key={i}>{note}</li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div style={{ flex: 1, height: "100%" }}>
        <MapContainer center={[22.54992, 0]} zoom={3} style={{ width: "100%", height: "100%" }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {route.stops.map((stop, i) => {
            const orderIndex = itinerary.route.findIndex((s) => s.placeName === stop.label);
            const isStart = orderIndex === -1;
            const isHovered = stop.label === hoveredLabel;
            const color = isHovered ? HOVER_COLOR : isStart ? START_COLOR : STOP_COLOR;
            const label = isStart ? "S" : String(orderIndex + 1);
            return (
              <Marker key={i} position={[stop.lat, stop.lng]} icon={createPinIcon(color, label)}>
                <Popup>{stop.label}</Popup>
              </Marker>
            );
          })}
          <Polyline positions={route.geometry} color="#4285F4" weight={5} opacity={0.9} />
          <FitBounds positions={route.geometry} />
        </MapContainer>
      </div>
    </div>
  );
};
