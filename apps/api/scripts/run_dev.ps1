# Dev API server — reload only watches src/ (not scripts/, alembic/, etc.)
# Usage from apps/api:
#   .\scripts\run_dev.ps1

$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)

Write-Host "Starting API on http://0.0.0.0:8000 (reload-dir=src)" -ForegroundColor Cyan
uvicorn main:app --reload --reload-dir src --host 0.0.0.0 --port 8000 --app-dir src
