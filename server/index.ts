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
  console.log("chekc env:", process.env.GEMINI_API_KEY);
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: `You are an itinerary planner assistant. The user wants to visint the following places: Morning Glory, Little lion cafe, The marine room, tacos el gordo, balboa park, beach at la jolla, harbor drive bridge in san diego, ca. Please put together a day plan for them
    based by checking the hours of operation and taking into account travel time between places and distance traveled. Keep in mind also the normal
    course of a day which includes breakfast, lunch, dinner and plan around that.
    Return the plan in a JSON object with the following fields:
    - date: the date of the plan
    - places: the places to visit
    - time: the time to visit each place
    - distance: the distance to travel between each place
    - duration: the duration of the trip
    - total_distance: the total distance of the trip
    - total_duration: the total duration of the trip
    `,
  });
  res.json(response.text);
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
