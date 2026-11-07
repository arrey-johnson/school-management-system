# Upgrade

Data lives on the Windows host bind mount. Replacing the image does **not** wipe pupils, fees, or backups.

1. Take a Super Admin backup from **System health** (extra safety).
2. Copy the new `promptstack-sms-image.tar` (or run the new setup exe).
3. Run `Upgrade-PromptstackSMS.ps1` as Administrator (or the new installer).
4. The container starts. If `schema.version` changed, the app writes an `upgrade` `.sms-backup` before applying the new tables, then listens.
5. Open **System health** and confirm version **0.8.0** (or newer) and integrity `ok`.

If the new container will not start, keep the previous image tag loaded and run `Start-PromptstackSMS.ps1` again. Do not delete `C:\ProgramData\PromptstackSMS`.
