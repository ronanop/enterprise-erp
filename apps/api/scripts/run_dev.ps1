# Dev API server - reload only watches src/ (not scripts/, alembic/, etc.)
# Usage from apps/api:
#   .\scripts\run_dev.ps1

$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)

# When Windows Application Control blocks psycopg_binary DLLs, psycopg falls
# back to its pure-Python driver, which needs system libpq on PATH.
$pgBin = Get-ChildItem "C:\Program Files\PostgreSQL\*\bin\libpq.dll" -ErrorAction SilentlyContinue |
    Sort-Object FullName -Descending |
    Select-Object -First 1
if ($pgBin) {
    $env:PATH = "$($pgBin.DirectoryName);$env:PATH"
}

Write-Host "Starting API on http://0.0.0.0:8000 (reload-dir=src)" -ForegroundColor Cyan
uvicorn main:app --reload --reload-dir src --host 0.0.0.0 --port 8000 --app-dir src
