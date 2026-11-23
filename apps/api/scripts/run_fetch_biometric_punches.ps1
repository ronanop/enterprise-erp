# Always-on biometric punch fetch (every 60s).
# Usage from apps/api:
#   .\scripts\run_fetch_biometric_punches.ps1
#   .\scripts\run_fetch_biometric_punches.ps1 -Once

param(
    [switch]$Once,
    [int]$Interval = 60
)

$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)

$pgBin = Get-ChildItem "C:\Program Files\PostgreSQL\*\bin\libpq.dll" -ErrorAction SilentlyContinue |
    Sort-Object FullName -Descending |
    Select-Object -First 1
if ($pgBin) {
    $env:PATH = "$($pgBin.DirectoryName);$env:PATH"
}

$argsList = @("scripts/fetch_biometric_punches.py", "--interval", "$Interval")
if ($Once) {
    $argsList += "--once"
}

Write-Host "Starting biometric punch fetcher (interval=${Interval}s)" -ForegroundColor Cyan
python @argsList
