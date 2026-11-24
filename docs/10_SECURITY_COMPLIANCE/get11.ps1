$ErrorActionPreference = "Stop"
$d = Join-Path $env:USERPROFILE "OneDrive - CACHE DIGITECH\Desktop"
New-Item -ItemType Directory -Force -Path $d | Out-Null
$dest = Join-Path $d "1.1-Solution-Architecture-HLD-LLD.pdf"
Write-Host "Downloading HLD PDF to $dest ..."
Invoke-WebRequest -Uri "http://172.16.200.30:8765/pdf/1.1-Solution-Architecture-HLD-LLD.pdf" -OutFile $dest
Write-Host "Done: $dest"
explorer /select,$dest
