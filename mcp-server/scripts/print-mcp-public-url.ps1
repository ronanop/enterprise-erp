# Print the current ngrok HTTPS URL for MCP (requires ngrok agent running).
$ErrorActionPreference = "Stop"

try {
    $resp = Invoke-RestMethod -Uri "http://127.0.0.1:4040/api/tunnels" -TimeoutSec 5
} catch {
    Write-Error "Cannot reach ngrok API at http://127.0.0.1:4040. Start tunnel first: .\mcp-server\scripts\tunnel-mcp.ps1"
}

$https = $resp.tunnels | Where-Object { $_.proto -eq "https" } | Select-Object -First 1
if (-not $https) {
    Write-Error "No HTTPS tunnel found. Is ngrok running?"
}

$base = $https.public_url.TrimEnd("/")
Write-Output "$base/mcp/"
