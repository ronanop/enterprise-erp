# Requires Administrator — allow LAN access to local ERP Postgres (Docker :5433)
$ErrorActionPreference = "Stop"
$name = "ERP Postgres 5433"
$existing = Get-NetFirewallRule -DisplayName $name -ErrorAction SilentlyContinue
if ($existing) {
    Write-Host "Rule already exists: $name"
}
else {
    New-NetFirewallRule -DisplayName $name -Direction Inbound -Protocol TCP -LocalPort 5433 -Action Allow -Profile Any | Out-Null
    Write-Host "Created firewall rule: $name"
}
Get-NetFirewallRule -DisplayName $name | Format-Table DisplayName, Enabled, Direction, Action
Write-Host "Done. Press Enter to close."
Read-Host
