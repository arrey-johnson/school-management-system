# Demo — Phase 7 Backup and health

1. Hard-refresh `http://localhost:3847` after `docker compose up --build`.
2. **System health** shows a red 48-hour warning until the first backup. Integrity should be `ok`.
3. Super Admin: **Create backup now**. The warning clears. Teacher cannot hit the backup API.
4. Add a throwaway pupil, then **Restore** the earlier archive after typing `RESTORE SCHOOL DATA`. The throwaway pupil is gone; a safety archive remains on disk.
5. **Audit log** → Verify audit integrity.
6. Drive stays “off (local only)” unless enabled in settings.
