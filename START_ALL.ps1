# Graph Viewer - Start All Services (Windows PowerShell)

$ErrorActionPreference = "Stop"

$rootPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendPath = Join-Path $rootPath "backend"
$frontendPath = Join-Path $rootPath "frontend"

Write-Host ""
Write-Host "Graph Viewer - Start All" -ForegroundColor Cyan
Write-Host "Root: $rootPath" -ForegroundColor DarkGray
Write-Host ""

$backendCommand = "Set-Location '$backendPath'; python main.py"
$frontendCommand = "Set-Location '$frontendPath'; npm start"

Write-Host "Starting backend window..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", $backendCommand | Out-Null

Write-Host "Starting frontend window..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", $frontendCommand | Out-Null

Write-Host ""
Write-Host "Graph Viewer is starting..." -ForegroundColor Cyan
Write-Host "Frontend: http://localhost:5173" -ForegroundColor White
Write-Host "Backend:  http://localhost:8000" -ForegroundColor White
Write-Host "API Docs: http://localhost:8000/docs" -ForegroundColor White
