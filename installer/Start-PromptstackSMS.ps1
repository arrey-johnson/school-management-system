#Requires -Version 5.1
param(
  [string]$InstallDir = (Split-Path -Parent $MyInvocation.MyCommand.Path),
  [int]$WaitSeconds = 180
)

$ErrorActionPreference = "Stop"
$composeFile = Join-Path $InstallDir "compose\docker-compose.yml"
$envFile = Join-Path $env:ProgramData "PromptstackSMS\.env"

function Wait-Docker {
  $deadline = (Get-Date).AddSeconds($WaitSeconds)
  while ((Get-Date) -lt $deadline) {
    docker info *> $null
    if ($LASTEXITCODE -eq 0) { return }
    Start-Sleep -Seconds 5
  }
  throw "Docker Engine did not become ready in $WaitSeconds seconds. Promptstack SMS cannot start without Docker (D031)."
}

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  throw "Docker is not installed. Install Docker Desktop or Engine, set it to start at boot, then re-run this script."
}

Wait-Docker

if (-not (Test-Path $composeFile)) {
  throw "Compose file missing: $composeFile"
}

$env:SMS_ENV_FILE = $envFile
$env:SMS_DATA_DIR = Join-Path $env:ProgramData "PromptstackSMS"
Set-Location $InstallDir
docker compose --env-file $envFile -f $composeFile up -d
if ($LASTEXITCODE -ne 0) {
  throw "docker compose up failed"
}
