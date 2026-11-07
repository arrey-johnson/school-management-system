#Requires -Version 5.1
param(
  [string]$InstallDir = "$env:ProgramFiles\PromptstackSMS",
  [switch]$RemoveData
)

$ErrorActionPreference = "Stop"
$composeFile = Join-Path $InstallDir "compose\docker-compose.yml"
if (Get-Command docker -ErrorAction SilentlyContinue) {
  if (Test-Path $composeFile) {
    docker compose -f $composeFile down
  }
}
schtasks /Delete /TN "PromptstackSMS" /F 2>$null
netsh advfirewall firewall delete rule name="Promptstack SMS" *> $null
$desktop = Join-Path ([Environment]::GetFolderPath("CommonDesktopDirectory")) "Open School System.lnk"
if (Test-Path $desktop) { Remove-Item $desktop -Force }
if ($RemoveData) {
  throw "Refusing to delete school data automatically. Remove C:\ProgramData\PromptstackSMS only after a verified backup."
}
Write-Host "App files can be removed from $InstallDir. School data was left in ProgramData."
