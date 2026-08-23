# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

An AI-assisted travel itinerary planner. Very early-stage / experimental: the user supplies a starting location, date, and desired stops (breakfast, lunch, dinner, primary/secondary activities, late-night activities); Gemini plans an efficient order of visits; OpenRouteService geocodes each stop and computes the actual driving route; the frontend renders it on a Leaflet/OpenStreetMap map.

## Commands

- `pnpm dev` — start the Vite frontend dev server (localhost:5173)
- `pnpm server` — start the Express/Gemini backend with `tsx --watch` (localhost:3001), loading env vars from `.env.local` (`NODE_ENV=local` → `.env.local`)
- `pnpm server:mock` — same, but with `MOCK_ITINERARY=true`: skips the real Gemini + OpenRouteService calls (both rate-limited on the free tier) and replays `server/mock-response.json`, a captured real response. Use this while iterating on the frontend so repeated testing doesn't burn quota.
- `pnpm build` — type-check (`tsc -b`) then build the frontend with Vite
- `pnpm lint` — run ESLint over the repo
- `pnpm format` — run Prettier (write mode) over the repo
- `pnpm preview` — preview the production frontend build

Both the frontend (`pnpm dev`) and backend (`pnpm server`) need to be running for the app to work end-to-end — the frontend calls the backend at `http://localhost:3001`.

There is no test setup in this repo currently.

## Environment variables

Set in `.env.local` (gitignored):
- `GEMINI_API_KEY` — used server-side by `server/gemini.ts`
- `OPENROUTESERVICE_API_KEY` — used server-side by `server/index.ts` for OpenRouteService geocoding (`/geocode/search`) and driving directions (`/v2/directions/driving-car/geojson`). Free, no billing/credit card required — sign up at openrouteservice.org.
- `VITE_GOOGLE_MAPS_API_KEY` — currently unused (leftover from an earlier Google Maps-based implementation); safe to leave unset.

The backend loads env vars via `dotenv.config({ path: \`.env.${process.env.NODE_ENV}\` })`, so `NODE_ENV` must be set (the `server` script sets it to `local`) for `.env.local` to be picked up.

## Architecture

Two separate runtimes, no shared server framework:

- **`server/`** — Express API (run with `tsx`, not compiled separately). `server/index.ts` builds a Gemini prompt from a hardcoded itinerary request shape (starting location, date, and buckets of desired places), calls the Gemini API with a `responseSchema` to get back structured JSON (an ordered `route` of `{placeName, address, category, arrivalTime, ...}` — no lat/lng; Gemini is unreliable at recalling exact coordinates). The backend then geocodes each place's address via OpenRouteService and requests a driving route between them (round trip, starting/ending at `startingLocation`). Stops that can't be geocoded plausibly (`haversineKm` sanity check) or aren't reachable by car (islands, ferry-only landmarks — `calculateRouteDroppingUnroutableStops`) are dropped and reported back in `omittedStops` rather than failing the whole request. Responds with `{ itinerary, route: { geometry, stops, summary, omittedStops } }`.
- **`src/`** — Vite/React 19 (RC) frontend. `src/App.tsx` renders a `react-leaflet` map with OpenStreetMap tiles (no API key needed) and triggers itinerary generation via a button that calls the backend. It renders a `Marker` per stop and a `Polyline` for the route geometry returned by the backend (already `[lat, lng]` pairs — no decoding needed since ORS's `/geojson` endpoint returns raw coordinates, unlike Google's encoded-polyline format). `src/Map/index.tsx` (`FitBounds`) fits the map viewport to the route once it loads; `src/Map/markerIcon.ts` works around Leaflet's default marker icon not resolving under Vite's bundler.
- Gemini's prompt (in `server/index.ts`) is the source of truth for the itinerary JSON shape — `itinerary.json` and `server/response.json` are stale example outputs from an earlier prompt/schema version (they predate the `responseSchema` structured-output switch and won't match the current shape).

Both `tsconfig.app.json` (frontend, DOM libs) and `tsconfig.node.json` (build tooling) are referenced from the root `tsconfig.json`; the backend under `server/` is executed directly by `tsx` rather than being part of either TS project's build.

## Notes for making changes

- Request/response shapes between the frontend and `server/index.ts` are currently loosely typed (`any` in several places) and the itinerary request data in `server/index.ts` is hardcoded rather than coming from user input yet — check current state before assuming either has changed.
- `cors` origins in `server/index.ts` are hardcoded to `localhost:3001` and `localhost:5173`; update both if ports change.
