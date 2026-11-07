# Backup and restore

## Where files live

On the school PC the Compose bind mount is `.data/` in development and `C:\ProgramData\PromptstackSMS\` in production (D010). Inside that folder:

- `app.db` — live database (never copy this file while the app is running)
- `uploads/` — letter/logo files
- `backups/*.sms-backup` — timestamped archives
- `logs/`

## Create a backup

1. Sign in as Super Admin.
2. Open **System health**.
3. Click **Create backup now**.
4. Wait until the new filename appears. Integrity must read `ok`.

A red banner means there has been no successful backup in 48 hours.

Scheduled backups run around 02:00 Africa/Douala and keep the last 14 archives (settings `backup.hour`, `backup.keepLast`).

Google Drive upload is **off** unless `backup.driveEnabled` is true. Local files remain the source of truth (D024).

## Restore

1. Create or pick an archive on **System health**.
2. Type exactly `RESTORE SCHOOL DATA`.
3. Click **Restore** on that row.
4. The server writes a **safety** archive of the current data, then replaces `app.db` and `uploads/`.
5. Sign in again if your session was in the replaced database.

Screenshot placeholders: health page with stale banner; backup list; confirmation field; restore success.

## Rules

- Snapshots use the SQLite backup API, not a file copy of the live DB.
- Restore always takes a safety backup first.
- Do not restore from a USB copy that fails validation (checksum or `integrity_check`).
