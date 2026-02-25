# Quickstart

## Fastest way (Windows)
```powershell
.\START_ALL.ps1
```

The script will open 2 PowerShell windows:
1. Backend: `python main.py`
2. Frontend: `npm start`

Prerequisite: install dependencies once before first run.

## Manual setup

### Backend
```bash
cd backend
pip install -r requirements.txt
python main.py
```

### Frontend
```bash
cd frontend
npm install
npm start
```

## From project root
```bash
npm run start:backend
npm run start:frontend
# or run both
npm run start:all
```

## Verify
- API health: `http://localhost:8000/health`
- App: `http://localhost:5173`
