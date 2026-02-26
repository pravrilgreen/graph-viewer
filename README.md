# Graph Viewer

Graph Viewer is a full-stack app to visualize and edit screen transition graphs.

## Stack

- Backend: FastAPI + NetworkX
- Frontend: React + TypeScript + React Flow + Vite
- Persistence: JSON file or MongoDB (configurable)

## Features

- Visual graph editor for screens and transitions
- Multi-edge transitions between the same source/target pair
- Read-only screen APIs and transition editing APIs
- Path finding:
  - shortest path (weighted)
  - simple path (minimum hops)
- Graph import/export APIs
- Configurable data source:
  - JSON (`backend/graph_data.json`) for local/dummy data
  - MongoDB for persisted environments

## Repository layout

- `backend/`: FastAPI service, graph model, seed script, mock screen assets
- `frontend/`: React app
- `START_ALL.ps1`: starts backend and frontend in separate PowerShell windows

## Environment files

Create local env files from examples:

1. `backend/.env.example` -> `backend/.env`
2. `frontend/.env.example` -> `frontend/.env`

### Backend variables

- `GRAPH_DATA_SOURCE`: `json` (default) or `mongodb`
- `GRAPH_FILE`: path to JSON graph file when using `json`
- `MONGO_URI`: Mongo connection string (required in `mongodb` mode)
- `MONGO_DB`: Mongo database name (required in `mongodb` mode)
- `MONGO_COLLECTION`: Mongo collection name (required in `mongodb` mode)
- `MONGO_GRAPH_ID`: document selector key (default: `default`)

### Frontend variables

- `VITE_API_URL`: backend base URL (default fallback in code: `http://localhost:8000`)

## Setup

### Backend

```bash
cd backend
python -m venv venv
# Windows: venv\Scripts\activate
# macOS/Linux: source venv/bin/activate
pip install -r requirements.txt
python main.py
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### From repository root

```bash
npm run start:backend
npm run start:frontend
# or both
npm run start:all
```

### Windows one-command start

```powershell
.\START_ALL.ps1
```

## Seed data

Generate dummy graph JSON:

```bash
npm run seed
```

This writes `backend/graph_data.json`.

## URLs

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:8000`
- API docs: `http://localhost:8000/docs`
- Health: `http://localhost:8000/health`

## API overview

- Screens:
  - `GET /screens`
  - `GET /screens/{screen_id}`
- Transitions:
  - `GET /transitions`
  - `GET /transitions/{from_screen}/{to_screen}`
  - `GET /transitions/{from_screen}/{to_screen}/all`
  - `GET /transitions/grouped`
  - `GET /transitions/id/{transition_id}`
  - `PUT /transitions`
- Paths:
  - `GET /path/shortest`
  - `GET /path/simple`
- Graph:
  - `GET /graph/stats`

## Notes

- In multi-edge scenarios, prefer using `transition_id` for update/delete/trigger operations.
- In MongoDB mode, backend expects one graph document per `graph_id`.
- Each screen can include `identityRegions` with explicit objects: `image[].region` and `text[].region`, plus `text[].values` (for example `vn`, `en`).
