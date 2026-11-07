# Clean Windows 10 / 11 verification

Goal: a PC with only Windows + Docker at boot can install from the bundled tarball and complete first-run with no internet.

## Checklist (run on a clean VM)

- [ ] Windows 10 64-bit VM: Docker Desktop start-on-login, `docker info` after reboot
- [ ] Windows 11 64-bit VM: same
- [ ] Copy installer + `promptstack-sms-image.tar` with network disconnected
- [ ] `Install-PromptstackSMS.ps1` succeeds; firewall rule TCP 3847 present
- [ ] Reboot; boot task starts Compose; `http://localhost:3847/setup` opens
- [ ] First-run wizard completes; change-password on first production login
- [ ] Second PC on the LAN opens `http://<server-ip>:3847`
- [ ] Upgrade tarball: data still present; `upgrade` backup exists under ProgramData `\backups`

## What this build verified (developer host)

Host: Windows 11 (`10.0.26200`). Docker Compose build/test/up for 0.8.0 on this machine. PowerShell installer scripts and Inno Setup source are in `installer/`. Full offline VM ticks above need a dedicated Win10 and Win11 VM with Docker — not executed in this agent session.

Proxy check used here: `docker compose build` (image tests including installer file assertions and pre-migration backup).
