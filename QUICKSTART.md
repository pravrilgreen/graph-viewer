# Quickstart

## 1) Prepare env files

1. Copy `backend/.env.example` to `backend/.env`
2. Copy `frontend/.env.example` to `frontend/.env`

## 2) Fastest way on Windows

```powershell
.\START_ALL.ps1
```

The script opens 2 PowerShell windows:
1. Backend: `python main.py`
2. Frontend: `npm start`

## 3) Manual setup

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

## 4) Root npm scripts

```bash
npm run start:backend
npm run start:frontend
npm run start:all
npm run seed
```

## 5) Verify

- API docs: `http://localhost:8000/docs`
- API health: `http://localhost:8000/health`
- Frontend app: `http://localhost:5173`
