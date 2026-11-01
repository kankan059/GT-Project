# Flood Evacuation Backend

This FastAPI backend demonstrates driving and walking evacuation routes around
Tezpur University. Shelters and flood scenarios are simulated; this is not an
emergency-response service.

## Setup

Run commands from the project root:

```powershell
python -m pip install -r backend/requirements.txt
python -m backend.scripts.generate_dataset
python -m uvicorn backend.app:app --reload
```

Dataset generation downloads and stores the OSM road graphs locally. It requires
internet access and should be run during setup, not from the API process. The
API reads `backend/data/networks/tezu_roads_drive.graphml`,
`backend/data/networks/tezu_roads_walk.graphml`, and the shelter/scenario CSVs.

Open `http://127.0.0.1:8000/docs` for the interactive API documentation.

## Frontend

Start the backend and generate its local datasets first. In a second terminal,
run from the project root:

```powershell
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000`. To use a different backend URL, copy
`frontend/.env.example` to `frontend/.env.local` and set
`NEXT_PUBLIC_API_BASE_URL`. See the project-root `done.md` for a summary of the
frontend features and current API limitations.

## API

- `GET /health`
- `GET /api/shelters`
- `GET /api/scenarios`
- `POST /api/routes/find`
- `POST /api/flood/update`
- `GET /api/critical-roads`

Manual flood updates apply to subsequent route requests while the server is
running. Status updates are in-memory and reset on restart. All route estimates
and flood conditions are demonstrations and must not be used for real
evacuation decisions.
