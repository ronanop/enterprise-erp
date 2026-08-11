# Start ERP web on 0.0.0.0:3000 (LAN-accessible; API proxied via next.config rewrites)
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location (Join-Path $root "apps\web")

Write-Host "Starting ERP web on http://0.0.0.0:3000 (use Network URL from output for LAN)" -ForegroundColor Cyan
npm run dev
