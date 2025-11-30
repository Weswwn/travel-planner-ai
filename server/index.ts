// server/server.js
import express from "express";
import dotenv from "dotenv";
dotenv.config({ path: `.env.${process.env.NODE_ENV}` });
import morgan from "morgan";
import { getAI } from "./gemini";
import cors from "cors";
import { FunctionDeclaration, Type } from "@google/genai";

const app = express();
const port = process.env.PORT || 3001;
const ai = getAI();

app.use(morgan("dev"));
app.use(
  cors({
    origin: ["http://localhost:3001", "http://localhost:5173"],
  }),
);
app.use(express.json());

const calculateBestRoute = async (route) => {
  const baseUrl = "https://maps.googleapis.com/maps/api/directions/json?";
  const origin = `${route[0].lat}, ${route[0].lng}`;

  const destination = `${route[route.length - 1].lat}, ${route[route.length - 1].lng}`;
  const waypoints = route
    .slice(1, -1)
    .map((place) => `${place.lat}, ${place.lng}`)
    .join("|");

  const params = new URLSearchParams({
    origin,
    destination,
    mode: "driving",
    key: process.env.VITE_GOOGLE_MAPS_API_KEY as string,
  });

  if (waypoints.length > 0) {
    params.append("waypoints", waypoints);
  }

  const response = await fetch(baseUrl + params.toString());
  const data = await response.json();

  console.log("check calculation response:", data);
  return data;
};

const calculateBestRouteDeclaration: FunctionDeclaration = {
  name: "calculate_best_route",
  description:
    "Use directions API and pipe in our route data so that we can use it to generate the map",
  parameters: {
    type: Type.OBJECT,
    properties: {
      route: {
        description: "The list of places that we will generate the route from",
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            lat: { type: Type.STRING },
            lng: { type: Type.STRING },
            time: { type: Type.STRING },
          },
        },
      },
    },
    required: ["route"],
  },
};

app.get("/", async (req, res) => {
  const data = {
    startingLocation: "750 Kearny St, San Francisco, CA 94108",
    date: "12-01-2025",
    data: {
      breakfast: ["3282 Mission St, San Francisco, CA 94110 - Four Chairs"],
      primaryActivities: [
        "Alcatraz Island",
        "Golden Gate Bridge",
        "San Francisco Museum of Modern Art",
      ],
      lunch: ["1555 Folsom St, San Francisco, CA 94103 - Spark Social"],
      dinner: [
        "1906 Van Ness Ave, San Francisco, CA 94109 - House of Prime Rib",
      ],
      lateNightActivities: [
        "1720 Polk St, San Francisco, CA 94133 - Bob's Donuts",
        "1900 Fillmore St, San Francisco, CA 94115 - The Alchemist",
      ],
      secondaryActivities: [
        "2180 Chestnut St, San Francisco, CA 94123 - Chinatown",
        "3555 A St, San Francisco, CA 94133 - Fisherman's Wharf",
        "3355 16th St, San Francisco, CA 94103 - Mission Dolores Park",
      ],
    },
  };
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: `You are an itinerary planner assistant. The user will provide the following information:
    - startingLocation: usually where they will be staying i.e, hotel, AirBnB, etc...
    - date: the date of the plan
    - data: A JSON object with the following fields:
      - breakfast: Breakfast spots they want to visit.
      - primaryActivities: Primary activities they want to do today.
      - lunch: Lunch spots they want to visit.
      - dinner: Dinner spots they want to visit.
      - lateNightActivities: Activities they want to do after dinner.
      - secondaryActivities: The secondary places they want to visit if the locations are convenient to visit on the way to the primary places and on the way back to the starting location.
    
    Rules to follow: 
    1. You will then determine the most efficient way to visit all the places in the least amount of time and distance traveled. 
    2. Do your best to include all the places in the plan. However, if the locations are too far apart, or you run out of time, you are able to skip places. Just make a note of it in the relevantInformation field.
    3. Keep in mind that you should follow the daily course of a day which includes breakfast, lunch, dinner and plan around that as much as possible.
    4. Find the lat/long of each place and include that in the response. If unable to find the lat/long, ignore the place and make a note of it in the misc relevantInformation field.
    5. For each place, add relevant information that would be helpful to the user. For example, if the place is a restaurant, add the hours of operation, any reservations required, etc...
    6. Return ONLY valid JSON. Do not include explanations, comments, markdown, or code fences.. Do not include any other text outside of the JSON object.
     - route: The array of places to visit in the order of the most efficient route
      - lat: The latitude of the place
      - lng: The longitude of the place
      - time: The time to visit the place
      - timeToTravelToNextLocation: The time to travel from the current location to the next location
      - relevantInformation: Any other relevant information that would be helpful to the user. For example, maybe the restaurant requires reservations or they are closed on the given day.
    - metadata: The metadata for the itinerary plan
      - estimatedTotalTime: The estimated total time to visit all the places
      - estimatedTotalDistance: The estimated total distance traveled
      - estimatedTravelTimeBetweenPlaces: The estimated travel time between each place
      - estimatedTravelBackToStartingLocation: The estimated travel time back to the starting location
    - otherRelevantInformation: Any other relevant information that would be helpful to the user. For example, maybe the restaurant requires reservations or they are closed on the given day.
    - Ensure that you call the calculate_best_route function to generate the route data points so that we can use it to generate the google map.

    ${JSON.stringify(data)}`,
    config: {
      // Grounding with Google Maps
      tools: [
        {
          googleMaps: {},
        },
      ],
    },
  });

  const cleanedText = response.text
    ?.replace(/```json/g, "")
    .replace(/```/g, "");
  const responseJSON = JSON.parse(cleanedText ?? "{}");
  console.log("check text:", responseJSON);
  const route = responseJSON?.["route"];
  const result = await calculateBestRoute(route);

  console.log("check route:", route);
  console.log("check result:", result);
  res.json({ baseResponse: response.text, mapsResponse: result });
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
