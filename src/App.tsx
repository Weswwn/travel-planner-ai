import { APIProvider, Map } from "@vis.gl/react-google-maps";
import "./App.css";
import { useEffect, useState } from "react";
import { MapComponent } from "./Map";
const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string;
console.log("check env:", API_KEY);

function App() {
  const [directions, setDirections] = useState<any>(null);

  const generateRoute = async () => {
    const response = await fetch("http://localhost:3001");
    const data = await response.json();
    if (data) {
      console.log("check data:", data);
      if (data) {
        setDirections(data.mapsResponse.geocoder_waypoints);
      }
    }
  };

  const data = [
    {
      geocoder_status: "OK",
      place_id: "ChIJ9ci1HQCBhYARF0NN23CgPOs",
      types: ["establishment", "point_of_interest", "restaurant"],
    },
    {
      geocoder_status: "OK",
      place_id: "ChIJfYhLb4yAhYARNEti1MDgzoY",
      types: ["establishment", "point_of_interest", "restaurant"],
    },
  ];

  return (
    <APIProvider apiKey={API_KEY}>
      <button onClick={generateRoute}>Click Here to Generate a Route</button>
      <Map
        style={{ width: "100vw", height: "100vh" }}
        defaultCenter={{ lat: 22.54992, lng: 0 }}
        defaultZoom={3}
        gestureHandling="greedy"
        // disableDefaultUI
      ></Map>
      <MapComponent directions={data} />
    </APIProvider>
  );
}

export default App;
