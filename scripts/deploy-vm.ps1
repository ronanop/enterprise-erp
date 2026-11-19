# Single-command VM go-live (Windows helper). Prefer deploy-vm.sh on Linux VMs.
param(
  [string]$EnvFile = ".env.vm",
  [string]$VmHost = ""
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

if (-not (Test-Path $EnvFile)) {
  if (Test-Path ".env.vm.example") {
    Copy-Item ".env.vm.example" $EnvFile
    Write-Host "Created $EnvFile from .env.vm.example — edit VM_HOST / secrets, then re-run."
    exit 1
  }
  throw "Missing $EnvFile"
}

New-Item -ItemType Directory -Force -Path "backups" | Out-Null
if (-not (Test-Path "backups\vm-seed-erp_hrms.dump")) {
  $latest = Get-ChildItem "backups\erp_hrms_full_*.dump" -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending | Select-Object -First 1
  if ($latest) {
    Copy-Item $latest.FullName "backups\vm-seed-erp_hrms.dump" -Force
    Write-Host "Seed: $($latest.Name) -> vm-seed-erp_hrms.dump"
  } else {
    Write-Warning "backups/vm-seed-erp_hrms.dump missing — DB will start empty."
  }
}
if (-not (Test-Path "backups\vm-seed-erp.dump")) {
  $latest = Get-ChildItem "backups\erp_full_*.dump" -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending | Select-Object -First 1
  if ($latest) {
    Copy-Item $latest.FullName "backups\vm-seed-erp.dump" -Force
    Write-Host "Seed: $($latest.Name) -> vm-seed-erp.dump"
  }
}

$env:VM_ENV_FILE = $EnvFile
Write-Host "Building and starting VM stack…"
docker compose -f docker-compose.vm.yml --env-file $EnvFile up -d --build

# Read VM_HOST from env file if not passed
if (-not $VmHost) {
  $line = Get-Content $EnvFile | Where-Object { $_ -match '^\s*VM_HOST=' } | Select-Object -First 1
  if ($line) { $VmHost = ($line -split '=', 2)[1].Trim() }
}
if (-not $VmHost) { $VmHost = "127.0.0.1" }

Write-Host ""
Write-Host "Live:"
Write-Host "  App:  http://$VmHost/"
Write-Host "  API:  http://$VmHost/api/v1/health"
Write-Host ""
Write-Host "Logs: docker compose -f docker-compose.vm.yml --env-file $EnvFile logs -f api web nginx"
