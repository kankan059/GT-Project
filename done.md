# Frontend implementation completed

## What was added

- Created a Next.js and TypeScript application in `frontend/`.
- Added an interactive OpenStreetMap view centered on Tezpur University, with
  map-click start selection, start marker, demo shelter markers, route drawing,
  route fitting, and map controls.
- Added place search using OpenStreetMap's Nominatim search service, limited to
  the Tezpur study area.
- Added driving/walking selection, flood scenario selection, and a route action
  wired to the existing FastAPI endpoints.
- Added route results for the recommended shelter, estimated time, distance,
  reachable alternatives, and unreachable shelter count.
- Added critical-road analysis and a manual simulated road-status update form.
- Added responsive styling, loading/error states, and a visible academic/demo
  safety disclaimer.
- Added `NEXT_PUBLIC_API_BASE_URL` support; the default backend address is
  `http://127.0.0.1:8000`.

## Existing API limitations surfaced in the interface

- The API returns geometry only for the recommended route, so alternative
  shelters can be selected/highlighted but their routes cannot be drawn.
- Critical-road results include node IDs but not coordinates, so critical roads
  are listed in the analysis panel but cannot be drawn on the map.
- The API does not provide flood-road geometries or a list of road statuses, so
  flooded/blocked road overlays cannot be drawn.
- Manual updates require a valid road edge ID. The frontend accepts an ID but
  cannot discover available IDs from the current API.
- Shelter data and routes depend on the backend's generated local datasets.

## Run locally

1. Follow the project-root `README.md` to install backend requirements, generate
   the road-network dataset, and start FastAPI.
2. In another terminal, run:

   ```powershell
   cd frontend
   npm install
   npm run dev
   ```
3. Open `http://localhost:3000`.

All shelters, flood scenarios, and route estimates are simulations. This
application is for academic demonstration and is not an emergency-response tool.
