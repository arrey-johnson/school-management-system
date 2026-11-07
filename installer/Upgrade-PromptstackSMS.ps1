#Requires -Version 5.1
param(
  [string]$InstallDir = "$env:ProgramFiles\PromptstackSMS",
  [string]$ImageTar = "",
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $ImageTar) {
  $ImageTar = Join-Path $here "payload\promptstack-sms-image.tar"
}

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  throw "Docker is required for upgrades. There is no host-Node path."
}

if (-not $DryRun) {
  docker info *> $null
  if ($LASTEXITCODE -ne 0) { throw "Docker Engine is not running." }
}

if (-not (Test-Path $ImageTar)) {
  throw "Upgrade tarball missing: $ImageTar"
}

Write-Host "Loading $ImageTar (data on the host bind mount is not replaced)"
if (-not $DryRun) {
  docker load -i $ImageTar
  if ($LASTEXITCODE -ne 0) { throw "docker load failed" }
  docker tag promptstack-sms:0.8.0 promptstack-sms:latest 2>$null
  $start = Join-Path $InstallDir "Start-PromptstackSMS.ps1"
  if (-not (Test-Path $start)) { $start = Join-Path $here "Start-PromptstackSMS.ps1" }
  & $start -InstallDir $InstallDir
}

Write-Host "Upgrade requested. On container start the app takes a pre-migration backup if the schema version changed."
