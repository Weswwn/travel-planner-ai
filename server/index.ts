// server/server.js
import express from "express";
import dotenv from "dotenv";
dotenv.config({ path: `.env.${process.env.NODE_ENV}` });
import morgan from "morgan";
import { getAI } from "./gemini";

const app = express();
const port = process.env.PORT || 3001;
const ai = getAI();

app.use(morgan("dev"));
app.use(express.json());

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
    4. Return the plan in a JSON object with the following details:
      - The best route to visit all the places
      - The estimated time to visit all the places
      - The estimated distance traveled
      - The estimated time to travel between each place
      - The estimated time to travel back to the starting location
    ${JSON.stringify(data)}`,
    config: {
      responseMimeType: "application/json",
      responseJsonSchema: {
        type: "object",
        description: "The itinerary plan",
        properties: {
          route: {
            description: "The route to visit all the places",
            type: "array",
            items: {
              type: "object",
              properties: {
                placeName: { type: "string" },
                estimatedTravelTimeFromPrevious: { type: "string" },
                estimatedArrivalTime: { type: "string" },
                estimatedTimeAtLocation: { type: "string" },
                estimatedDepartureTime: { type: "string" },
              },
            },
          },
          relevantInformation: {
            description:
              "Any other relevant information that would be helpful to the user. For example, maybe the restaurant requires reservations or they are closed on the given day.",
            type: "array",
            items: { type: "string" },
          },
          metadata: {
            description: "The metadata for the itinerary plan",
            type: "object",
            properties: {
              estimatedTotalTime: { type: "string" },
              estimatedTotalDistance: { type: "string" },
              estimatedTravelTimeBetweenPlaces: { type: "string" },
              estimatedTravelBackToStartingLocation: { type: "string" },
            },
          },
        },
      },
    },
  });
  console.log("check response:", response);
  console.log("check response text:", response.text);
  res.json(response.text);
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
