# Installer payload

1. On a build PC with Docker: `pnpm package:win` (or `scripts/package-win.ps1`). That writes `installer/payload/promptstack-sms-image.tar`.
2. Compile `promptstack-sms.iss` with Inno Setup 6, **or** copy this folder to the school server and run `Install-PromptstackSMS.ps1` as Administrator.
3. Docker Engine must already be installed and set to start at boot. The installer fails closed if `docker info` fails.
4. After install, open `http://localhost:3847/setup`.

School data is never stored only in the image. It lives in `C:\ProgramData\PromptstackSMS\`.
