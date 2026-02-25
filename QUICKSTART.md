# Quickstart

## Fastest way (Windows)
```powershell
.\START_ALL.ps1
```

The script will:
1. Create backend `venv` if missing
2. Install backend dependencies
3. Install frontend dependencies
4. Open 2 PowerShell windows for backend/frontend dev servers

## Manual setup

### Backend
```bash
cd backend
python -m venv venv
# Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## Verify
- API health: `http://localhost:8000/health`
- App: `http://localhost:5173`
