# Graph Viewer

Graph Viewer is a full-stack app to design, edit, and analyze screen transition flows.

## Stack
- Backend: FastAPI + NetworkX
- Frontend: React + TypeScript + React Flow + Vite

## Features
- Graph editor for screens and transitions
- Create, update, delete screen/transition
- Transition condition fields (`condition_id`, `conditionIds`)
- Trigger transition from UI
- Path finding:
  - shortest path (weighted)
  - simple path (minimum hops)
- Import/export graph JSON
- Auto-save to `backend/graph_data.json`

## Run

### Windows (one command)
```powershell
.\START_ALL.ps1
```
Note: this script only starts services. Install dependencies once first.

### Manual
Backend:
```bash
cd backend
python -m venv venv
# Windows: venv\Scripts\activate
# macOS/Linux: source venv/bin/activate
pip install -r requirements.txt
python main.py
```

Frontend:
```bash
cd frontend
npm install
npm start
```

### From project root
```bash
npm run start:backend
npm run start:frontend
npm run start:all
```

## URLs
- Frontend: http://localhost:5173
- Backend: http://localhost:8000
- API Docs: http://localhost:8000/docs

## API (main)
- Screens: `POST /screens`, `GET /screens`, `GET /screens/{id}`, `DELETE /screens/{id}`, `PUT /screens/rename`
- Transitions: `POST /transitions`, `GET /transitions`, `GET /transitions/{from}/{to}`, `PUT /transitions`, `DELETE /transitions/{from}/{to}`, `POST /transitions/trigger`
- Path: `GET /path/shortest`, `GET /path/simple`
- Graph: `GET /graph/export`, `POST /graph/import`, `POST /graph/clear`, `GET /graph/stats`
