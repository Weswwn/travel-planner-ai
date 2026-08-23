import { MapContainer, TileLayer, Marker, Popup, Polyline } from "react-leaflet";
import "./App.css";
import { useState } from "react";
import { FitBounds } from "./Map";
import { defaultIcon } from "./Map/markerIcon";

type RouteStop = {
  lat: number;
  lng: number;
  label: string;
};

type RouteData = {
  geometry: [number, number][];
  stops: RouteStop[];
  summary: { distance: number; duration: number };
  omittedStops: string[];
};

function App() {
  const [route, setRoute] = useState<RouteData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateRoute = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("http://localhost:3001");
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to generate itinerary");
      }
      setRoute(data.route);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={generateRoute}
        disabled={loading}
        style={{ position: "absolute", top: 10, left: 10, zIndex: 1000 }}
      >
        {loading ? "Generating..." : "Click Here to Generate a Route"}
      </button>
      {error && (
        <p
          style={{
            position: "absolute",
            top: 50,
            left: 10,
            maxWidth: 260,
            zIndex: 1000,
            color: "red",
            background: "white",
            padding: 4,
          }}
        >
          {error}
        </p>
      )}
      {!!route?.omittedStops.length && (
        <p
          style={{
            position: "absolute",
            top: 50,
            left: 10,
            maxWidth: 260,
            zIndex: 1000,
            color: "#b8860b",
            background: "white",
            padding: 4,
          }}
        >
          Not drivable, left off the map: {route.omittedStops.join(", ")}
        </p>
      )}
      <MapContainer
        center={[22.54992, 0]}
        zoom={3}
        style={{ width: "100vw", height: "100vh" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {route?.stops.map((stop, i) => (
          <Marker key={i} position={[stop.lat, stop.lng]} icon={defaultIcon}>
            <Popup>{stop.label}</Popup>
          </Marker>
        ))}
        {route && <Polyline positions={route.geometry} color="#4285F4" weight={5} opacity={0.9} />}
        {route && <FitBounds positions={route.geometry} />}
      </MapContainer>
    </>
  );
}

export default App;
