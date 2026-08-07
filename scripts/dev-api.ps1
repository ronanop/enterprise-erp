# Start ERP API with stable reload (watches src/ only — avoids reload storms)
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location (Join-Path $root "apps\api")

if (-not (Test-Path ".\.venv\Scripts\Activate.ps1")) {
  Write-Host "Create venv first: python -m venv .venv; .\.venv\Scripts\Activate.ps1; pip install -e `".[dev]`""
  exit 1
}

. .\.venv\Scripts\Activate.ps1
uvicorn main:app --reload --reload-dir src --host 0.0.0.0 --port 8000 --app-dir src
