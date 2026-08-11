# Start ERP API without auto-reload (stable for LAN/mobile testing — no reload connection storms)
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location (Join-Path $root "apps\api")

if (-not (Test-Path ".\.venv\Scripts\Activate.ps1")) {
  Write-Host "Create venv first: python -m venv .venv; .\.venv\Scripts\Activate.ps1; pip install -e `".[dev]`""
  exit 1
}

. .\.venv\Scripts\Activate.ps1
Write-Host "Starting API on http://0.0.0.0:8000 (no reload — stable for network testing)" -ForegroundColor Cyan
uvicorn main:app --host 0.0.0.0 --port 8000 --app-dir src
