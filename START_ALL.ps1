# Graph Viewer - Start All Services (Windows PowerShell)

$ErrorActionPreference = "Stop"

$rootPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendPath = Join-Path $rootPath "backend"
$frontendPath = Join-Path $rootPath "frontend"

function Resolve-PythonLauncher {
    if (Get-Command python -ErrorAction SilentlyContinue) {
        return "python"
    }
    if (Get-Command py -ErrorAction SilentlyContinue) {
        return "py"
    }
    throw "Python was not found in PATH. Install Python 3 and try again."
}

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    throw "npm was not found in PATH. Install Node.js (with npm) and try again."
}

$pythonLauncher = Resolve-PythonLauncher
$usePyLauncher = $pythonLauncher -eq "py"

Write-Host ""
Write-Host "Graph Viewer - Start All" -ForegroundColor Cyan
Write-Host "Root: $rootPath" -ForegroundColor DarkGray
Write-Host ""

$backendCommand = @"
Set-Location '$backendPath'

if ((-not (Test-Path '.env')) -and (Test-Path '.env.example')) {
    Copy-Item '.env.example' '.env'
    Write-Host 'Created backend/.env from .env.example' -ForegroundColor Yellow
}

if (-not (Test-Path 'venv\Scripts\python.exe')) {
    Write-Host 'Creating backend virtual environment...' -ForegroundColor Yellow
    if ($usePyLauncher) {
        & py -3 -m venv venv
    }
    else {
        & python -m venv venv
    }
}

`$venvPython = Join-Path (Get-Location) 'venv\Scripts\python.exe'
`$depsMarker = '.deps.installed'
`$needInstall = -not (Test-Path `$depsMarker)

if (-not `$needInstall) {
    `$reqTime = (Get-Item 'requirements.txt').LastWriteTimeUtc
    `$markerTime = (Get-Item `$depsMarker).LastWriteTimeUtc
    if (`$reqTime -gt `$markerTime) {
        `$needInstall = `$true
    }
}

if (`$needInstall) {
    Write-Host 'Installing backend dependencies...' -ForegroundColor Yellow
    & `$venvPython -m pip install --upgrade pip
    & `$venvPython -m pip install -r requirements.txt
    Set-Content -Path `$depsMarker -Value (Get-Date -Format o)
}

& `$venvPython main.py
"@

$frontendCommand = @"
Set-Location '$frontendPath'

if ((-not (Test-Path '.env')) -and (Test-Path '.env.example')) {
    Copy-Item '.env.example' '.env'
    Write-Host 'Created frontend/.env from .env.example' -ForegroundColor Yellow
}

if (-not (Test-Path 'node_modules')) {
    Write-Host 'Installing frontend dependencies...' -ForegroundColor Yellow
    npm install
}

npm start
"@

Write-Host "Starting backend window..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", $backendCommand | Out-Null

Write-Host "Starting frontend window..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", $frontendCommand | Out-Null

Write-Host ""
Write-Host "Graph Viewer is starting..." -ForegroundColor Cyan
Write-Host "Frontend: http://localhost:5173" -ForegroundColor White
Write-Host "Backend:  http://localhost:8000" -ForegroundColor White
Write-Host "API Docs: http://localhost:8000/docs" -ForegroundColor White
