$ErrorActionPreference = "Stop"
$d = Join-Path $env:USERPROFILE "OneDrive - CACHE DIGITECH\Desktop\iConnectPlus-Security-Compliance-Pack-v2.0-OnPrem-VPN"
New-Item -ItemType Directory -Force -Path $d | Out-Null
$z = Join-Path $d "iConnectPlus-Security-Compliance-Pack-v2.0-OnPrem-VPN.zip"
Write-Host "Downloading on-prem/VPN security pack to $d ..."
Invoke-WebRequest -Uri "http://172.16.200.30:8765/iConnectPlus-Security-Compliance-Pack-v2.0-OnPrem-VPN.zip" -OutFile $z
Expand-Archive -Path $z -DestinationPath $d -Force
Write-Host "Done."
explorer $d
