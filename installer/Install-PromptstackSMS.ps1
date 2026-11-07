#Requires -Version 5.1
param(
  [string]$InstallDir = "$env:ProgramFiles\PromptstackSMS",
  [string]$DataDir = "$env:ProgramData\PromptstackSMS",
  [string]$ImageTar = "",
  [switch]$Demo,
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $ImageTar) {
  $ImageTar = Join-Path $here "payload\promptstack-sms-image.tar"
}

$plan = [System.Collections.Generic.List[string]]::new()
function Step([string]$msg) {
  $plan.Add($msg) | Out-Null
  Write-Host $msg
}

Step "InstallDir=$InstallDir"
Step "DataDir=$DataDir"

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  throw "Docker is not on PATH. Install Docker and enable start-at-boot, then run this installer again. There is no host-Node fallback."
}

if (-not $DryRun) {
  docker info *> $null
  if ($LASTEXITCODE -ne 0) {
    throw "Docker Engine is not running (docker info failed). Start Docker, then retry. The school system will not run without it."
  }
} else {
  Step "DryRun: skip docker info"
}

$dirs = @(
  $InstallDir,
  (Join-Path $InstallDir "compose"),
  $DataDir,
  (Join-Path $DataDir "uploads"),
  (Join-Path $DataDir "logs"),
  (Join-Path $DataDir "backups")
)
foreach ($d in $dirs) {
  Step "Ensure directory $d"
  if (-not $DryRun) { New-Item -ItemType Directory -Force -Path $d | Out-Null }
}

$envPath = Join-Path $DataDir ".env"
if (-not (Test-Path $envPath)) {
  $bytes = New-Object byte[] 32
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  $secret = ([System.BitConverter]::ToString($bytes) -replace "-", "").ToLowerInvariant()
  $demoVal = $(if ($Demo) { "1" } else { "0" })
  $envBody = @"
SMS_SESSION_SECRET=$secret
SMS_DEMO=$demoVal
SMS_HOST=0.0.0.0
SMS_PORT=3847
SMS_DATA_DIR=/data
"@
  Step "Write session secret env $envPath"
  if (-not $DryRun) { Set-Content -Path $envPath -Value $envBody -Encoding ASCII }
} else {
  Step "Keep existing $envPath"
}

Step "Copy Compose files"
if (-not $DryRun) {
  Copy-Item -Force (Join-Path $here "compose\docker-compose.yml") (Join-Path $InstallDir "compose\docker-compose.yml")
  Copy-Item -Force (Join-Path $here "Start-PromptstackSMS.ps1") (Join-Path $InstallDir "Start-PromptstackSMS.ps1")
  Copy-Item -Force (Join-Path $here "Upgrade-PromptstackSMS.ps1") (Join-Path $InstallDir "Upgrade-PromptstackSMS.ps1")
}

if (-not (Test-Path $ImageTar)) {
  if ($DryRun) {
    Step "DryRun: missing $ImageTar (would fail on a real install)"
  } else {
    throw "Bundled image tarball not found: $ImageTar. Run scripts/package-win.ps1 on a build PC, then copy payload\promptstack-sms-image.tar next to this installer."
  }
} else {
  Step "docker load $ImageTar"
  if (-not $DryRun) {
    docker load -i $ImageTar
    if ($LASTEXITCODE -ne 0) { throw "docker load failed" }
    docker tag promptstack-sms:0.8.0 promptstack-sms:latest 2>$null
  }
}

Step "Firewall TCP 3847"
if (-not $DryRun) {
  netsh advfirewall firewall delete rule name="Promptstack SMS" *> $null
  netsh advfirewall firewall add rule name="Promptstack SMS" dir=in action=allow protocol=TCP localport=3847 | Out-Null
}

$startScript = Join-Path $InstallDir "Start-PromptstackSMS.ps1"
Step "Register boot task PromptstackSMS"
if (-not $DryRun) {
  schtasks /Create /TN "PromptstackSMS" /SC ONSTART /RL HIGHEST /RU SYSTEM /TR "powershell.exe -NoProfile -ExecutionPolicy Bypass -File `"$startScript`"" /F | Out-Null
}

$desktop = [Environment]::GetFolderPath("CommonDesktopDirectory")
$shortcutPath = Join-Path $desktop "Open School System.lnk"
Step "Desktop shortcut $shortcutPath"
if (-not $DryRun) {
  $w = New-Object -ComObject WScript.Shell
  $s = $w.CreateShortcut($shortcutPath)
  $s.TargetPath = "http://localhost:3847"
  $s.Description = "Promptstack School Management"
  $s.Save()
}

if (-not $DryRun) {
  & $startScript -InstallDir $InstallDir
}

$planPath = Join-Path $DataDir "last-install-plan.txt"
Step "Wrote plan $planPath"
if (-not $DryRun) { $plan | Set-Content -Path $planPath -Encoding UTF8 }

Write-Host "Open http://localhost:3847/setup to finish first-run. Data stays in $DataDir."
