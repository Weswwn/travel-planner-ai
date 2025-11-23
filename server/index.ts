// server/server.js
import express from "express";
import dotenv from "dotenv";
dotenv.config({ path: `.env.${process.env.NODE_ENV}` });
import morgan from "morgan";
import { ai } from "./gemini";

const app = express();
const port = process.env.PORT || 3001;

app.use(morgan("dev"));
app.use(express.json()); // For parsing JSON request bodies

// Example API route
app.get("/", (req, res) => {
  console.log("chekc env:", process.env.GEMINI_API_KEY);
  res.json({ message: "Hello World" });
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
