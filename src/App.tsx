import { MapContainer, TileLayer, Marker, Popup, Polyline } from "react-leaflet";
import "./App.css";
import { useState } from "react";
import { FitBounds } from "./Map";
import { createPinIcon } from "./Map/markerIcon";

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

type ItineraryStop = {
  placeName: string;
  address: string;
  category?: string;
  arrivalTime?: string;
  timeAtLocation?: string;
  travelTimeFromPrevious?: string;
  notes?: string;
};

type Itinerary = {
  route: ItineraryStop[];
  metadata?: { estimatedTotalTime?: string; estimatedTotalDistance?: string };
  relevantInformation?: string[];
};

type MapStop = {
  lat: number;
  lng: number;
  label: string;
};

type RouteData = {
  geometry: [number, number][];
  stops: MapStop[];
  summary: { distance: number; duration: number };
  omittedStops: string[];
};

function App() {
  const [itinerary, setItinerary] = useState<Itinerary | null>(null);
  const [route, setRoute] = useState<RouteData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hoveredLabel, setHoveredLabel] = useState<string | null>(null);

  const generateRoute = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("http://localhost:3001");
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to generate itinerary");
      }
      setItinerary(data.itinerary);
      setRoute(data.route);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", height: "100vh", width: "100vw" }}>
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
        <button onClick={generateRoute} disabled={loading} style={{ width: "100%" }}>
          {loading ? "Generating..." : "Click Here to Generate a Route"}
        </button>

        {error && (
          <p style={{ color: "red", marginTop: 12 }}>{error}</p>
        )}

        {!!route?.omittedStops.length && (
          <p style={{ color: "#b8860b", marginTop: 12 }}>
            Not drivable, left off the map: {route.omittedStops.join(", ")}
          </p>
        )}

        {route && (
          <a
            href={buildGoogleMapsUrl(route.stops) ?? undefined}
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: "block", marginTop: 12 }}
          >
            Open this route in Google Maps
          </a>
        )}

        {itinerary && (
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
                    backgroundColor:
                      hoveredLabel === stop.placeName ? "#fdecea" : "transparent",
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
        )}
      </div>

      <div style={{ flex: 1, height: "100%" }}>
        <MapContainer center={[22.54992, 0]} zoom={3} style={{ width: "100%", height: "100%" }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {route?.stops.map((stop, i) => {
            const orderIndex = itinerary?.route.findIndex((s) => s.placeName === stop.label) ?? -1;
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
          {route && (
            <Polyline positions={route.geometry} color="#4285F4" weight={5} opacity={0.9} />
          )}
          {route && <FitBounds positions={route.geometry} />}
        </MapContainer>
      </div>
    </div>
  );
}

export default App;
