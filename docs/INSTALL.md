# Install on the school server

Docker is mandatory. There is no “install Node and run the exe” path.

## Hardware

- Windows 10 or 11, 64-bit
- Virtualization enabled in BIOS
- WSL2 if you use Docker Desktop
- 8 GB RAM minimum, 16 GB recommended
- Disk on the PC itself (not a USB stick) for `C:\ProgramData\PromptstackSMS`

## Before the installer

1. Install Docker Desktop (or Docker Engine) and sign in if it asks.
2. Docker Desktop → Settings → **Start Docker Desktop when you sign in**.
3. Leave the school-server Windows account logged in, or set auto-logon, so Docker is up after a reboot.
4. Confirm in PowerShell: `docker info` prints server information.

## Install

1. Copy `PromptstackSMS-Setup-0.8.0.exe` (from Inno Setup) **or** the `installer\` folder plus `payload\promptstack-sms-image.tar`.
2. Run as Administrator: the setup exe, or `Install-PromptstackSMS.ps1`.
3. The script fails if Docker is missing or `docker info` fails.
4. It loads the bundled image (no internet pull), writes `C:\ProgramData\PromptstackSMS\.env`, opens TCP **3847**, registers a boot task, creates **Open School System** on the desktop, and starts Compose.

## First run

1. Open `http://localhost:3847/setup` (or the desktop shortcut).
2. Create the Super Admin. You will be asked to change that password on first login (production).
3. Enter school name **ALL BRIGHT CHILDREN**, then the academic year and terms.
4. Finish setup. Other PCs use `http://<server-ip>:3847` — the LAN URL and QR code are on **System health**.

## Build the payload (Promptstack only)

On a PC that already has Docker:

```powershell
pnpm package:win
```

Then compile `installer/promptstack-sms.iss` with Inno Setup 6.
