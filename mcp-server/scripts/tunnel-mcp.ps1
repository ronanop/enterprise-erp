# Expose local ERP API (MCP at /mcp/) via ngrok for ElevenLabs.
# Usage (from repo root):
#   1. Start API: cd apps/api; uvicorn main:app --host 0.0.0.0 --port 8000
#   2. Run: .\mcp-server\scripts\tunnel-mcp.ps1
#
# Requires ngrok: https://ngrok.com/download
# One-time: ngrok config add-authtoken <token>

param(
    [int]$Port = 0,
    [string]$NgrokConfig = ""
)

$ErrorActionPreference = "Stop"

if ($Port -le 0) {
    if ($env:API_PORT) {
        $Port = [int]$env:API_PORT
    } else {
        $Port = 8000
    }
}

$ngrok = Get-Command ngrok -ErrorAction SilentlyContinue
if (-not $ngrok) {
    Write-Error "ngrok not found on PATH. Install from https://ngrok.com/download then run: ngrok config add-authtoken <token>"
}

Write-Host "Tunneling http://127.0.0.1:$Port -> public HTTPS (MCP path: /mcp/)"
Write-Host "Ensure the API is running (uvicorn main:app --host 0.0.0.0 --port $Port)."
Write-Host ""

$ngrokArgs = @("http", $Port.ToString(), "--log=stdout")
if ($NgrokConfig -and (Test-Path $NgrokConfig)) {
    $ngrokArgs = @("--config", $NgrokConfig, "http", $Port.ToString(), "--log=stdout")
}

$proc = Start-Process -FilePath $ngrok.Source -ArgumentList $ngrokArgs -PassThru -NoNewWindow

function Get-NgrokPublicUrl {
    try {
        $resp = Invoke-RestMethod -Uri "http://127.0.0.1:4040/api/tunnels" -TimeoutSec 3
        $https = $resp.tunnels | Where-Object { $_.proto -eq "https" } | Select-Object -First 1
        if ($https) { return $https.public_url.TrimEnd("/") }
    } catch {
        return $null
    }
    return $null
}

$publicBase = $null
for ($i = 0; $i -lt 30; $i++) {
    Start-Sleep -Seconds 1
    $publicBase = Get-NgrokPublicUrl
    if ($publicBase) { break }
}

if ($publicBase) {
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "ElevenLabs MCP server URL:" -ForegroundColor Green
    Write-Host "  $publicBase/mcp/" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Keep MCP_SERVER_BASE_URL=http://127.0.0.1:$Port in apps/api/.env for internal tool calls."
    Write-Host "Dashboard: http://127.0.0.1:4040"
    Write-Host "========================================" -ForegroundColor Green
} else {
    Write-Host "ngrok started but public URL not ready yet. Open http://127.0.0.1:4040 or run:"
    Write-Host "  .\mcp-server\scripts\print-mcp-public-url.ps1"
}

Write-Host ""
Write-Host "Press Ctrl+C to stop the tunnel."

try {
    Wait-Process -Id $proc.Id
} finally {
    if (-not $proc.HasExited) {
        Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
    }
}
