# Demo — Phase 8 handover

1. `docker compose up --build` and hard-refresh `http://localhost:3847`.
2. If the database is empty, complete **First-run setup**.
3. **System health**: version 0.8.5, LAN URL, QR code, runtime “Docker Compose”.
4. Super Admin: **Fill with demo data** → **Yes, load demo data**. Wait for the spinner. Sign in as `demo.bursar` / `DemoPass123` (and the other `demo.*` role accounts) to walk the screens.
5. Super Admin: **Reset demo data** → **Yes, reset demo data** before official records. School profile and the Super Admin account stay.
6. Create a backup. On a school PC, the same flow is `Install-PromptstackSMS.ps1` then the desktop shortcut **Open School System**.
7. Show that Docker-down means the site is down — start Docker, then `Start-PromptstackSMS.ps1`.
