# Transition Map Builder - Start All Services (Windows PowerShell)

$ErrorActionPreference = "Stop"

$rootPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendPath = Join-Path $rootPath "backend"
$frontendPath = Join-Path $rootPath "frontend"
$backendVenvPath = Join-Path $backendPath "venv"
$backendPython = Join-Path $backendPath "venv\Scripts\python.exe"
$backendPyvenvCfg = Join-Path $backendPath "venv\pyvenv.cfg"

Write-Host ""
Write-Host "Transition Map Builder - Start All" -ForegroundColor Cyan
Write-Host "Root: $rootPath" -ForegroundColor DarkGray
Write-Host ""

if ((-not (Test-Path $backendPython)) -or (-not (Test-Path $backendPyvenvCfg))) {
    if (Test-Path $backendVenvPath) {
        Write-Host "Detected invalid backend virtual environment. Rebuilding..." -ForegroundColor Yellow
        Remove-Item -Path $backendVenvPath -Recurse -Force
    } else {
        Write-Host "Creating backend virtual environment..." -ForegroundColor Yellow
    }
    Push-Location $backendPath
    python -m venv venv
    Pop-Location
}

Write-Host "Installing backend dependencies..." -ForegroundColor Yellow
Push-Location $backendPath
& $backendPython -m pip install -r requirements.txt | Out-Null
Pop-Location

Write-Host "Installing frontend dependencies..." -ForegroundColor Yellow
Push-Location $frontendPath
npm install --no-audit | Out-Null
Pop-Location

$backendCommand = "Set-Location '$backendPath'; & '$backendPython' -m uvicorn main:app --reload --host 127.0.0.1 --port 8000"
$frontendCommand = "Set-Location '$frontendPath'; npm run dev"

Write-Host "Starting backend window..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", $backendCommand | Out-Null

Write-Host "Starting frontend window..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", $frontendCommand | Out-Null

Write-Host ""
Write-Host "Transition Map Builder is starting..." -ForegroundColor Cyan
Write-Host "Frontend: http://localhost:5173" -ForegroundColor White
Write-Host "Backend:  http://localhost:8000" -ForegroundColor White
Write-Host "API Docs: http://localhost:8000/docs" -ForegroundColor White
