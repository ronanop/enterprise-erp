# Copy repo + .env.coolify to Coolify server and run day1 script.
# Usage (from repo root, after setting SSH user):
#   $env:COOLIFY_SSH = "youruser@172.16.200.26"
#   .\scripts\deploy\push-day1-to-server.ps1

param(
    [string]$SshTarget = $env:COOLIFY_SSH,
    [string]$InstallDir = "/opt/enterprise-erp"
)

$ErrorActionPreference = "Stop"
$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")

if (-not $SshTarget) {
    Write-Host "Set COOLIFY_SSH, e.g. root@172.16.200.26 or deploy@172.16.200.26"
    exit 1
}

$EnvFile = Join-Path $RepoRoot ".env.coolify"
if (-not (Test-Path $EnvFile)) {
    Write-Host "Missing .env.coolify at repo root. Run from a machine that has generated it."
    exit 1
}

Write-Host "==> Creating remote directory"
ssh $SshTarget "sudo mkdir -p $InstallDir && sudo chown `$USER:`$USER $InstallDir"

Write-Host "==> Syncing project (excludes node_modules, .venv, .next)"
$rsync = Get-Command rsync -ErrorAction SilentlyContinue
if ($rsync) {
    rsync -avz --delete `
        --exclude node_modules --exclude .venv --exclude .next --exclude .git `
        "$RepoRoot/" "${SshTarget}:${InstallDir}/"
} else {
    Write-Host "rsync not found; using scp for deploy script + env + compose (full clone still needed on server)"
    scp $EnvFile "${SshTarget}:${InstallDir}/.env.coolify"
    scp (Join-Path $RepoRoot "docker-compose.coolify.yml") "${SshTarget}:${InstallDir}/"
    scp (Join-Path $RepoRoot "scripts/deploy/day1-coolify-compose.sh") "${SshTarget}:${InstallDir}/day1.sh"
    Write-Host "On server: git clone into $InstallDir then re-copy .env.coolify"
}

if ($rsync) {
    scp $EnvFile "${SshTarget}:${InstallDir}/.env.coolify"
}

Write-Host "==> Running day1 script on server"
ssh $SshTarget "chmod +x ${InstallDir}/scripts/deploy/day1-coolify-compose.sh 2>/dev/null; bash ${InstallDir}/scripts/deploy/day1-coolify-compose.sh"

Write-Host "==> Complete. Test: http://172.16.200.26:8080/api/v1/health"
