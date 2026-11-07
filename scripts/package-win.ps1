#Requires -Version 5.1
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root

New-Item -ItemType Directory -Force -Path (Join-Path $root "installer\payload") | Out-Null
Write-Host "Building promptstack-sms:0.8.0"
docker build -t promptstack-sms:0.8.0 -t promptstack-sms:latest $root
if ($LASTEXITCODE -ne 0) { throw "docker build failed" }

$tar = Join-Path $root "installer\payload\promptstack-sms-image.tar"
if (Test-Path $tar) { Remove-Item $tar -Force }
Write-Host "Saving $tar"
docker save promptstack-sms:0.8.0 -o $tar
if ($LASTEXITCODE -ne 0) { throw "docker save failed" }
Write-Host "Package ready. Compile installer/promptstack-sms.iss or copy installer/ to the school PC."
