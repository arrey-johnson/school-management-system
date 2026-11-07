export const PHASE7_SQL = `
CREATE TABLE IF NOT EXISTS backups (
  id TEXT PRIMARY KEY,
  filename TEXT NOT NULL UNIQUE,
  checksum TEXT NOT NULL,
  bytes INTEGER NOT NULL,
  counts_json TEXT NOT NULL,
  integrity TEXT NOT NULL,
  drive_status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  created_by TEXT,
  kind TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS drive_queue (
  id TEXT PRIMARY KEY,
  backup_id TEXT NOT NULL,
  status TEXT NOT NULL,
  last_error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pupils_name ON pupils(family_name, given_name);
CREATE INDEX IF NOT EXISTS idx_enrolments_class ON enrolments(class_id);
CREATE INDEX IF NOT EXISTS idx_payments_entry_date ON payments(entry_date);
CREATE INDEX IF NOT EXISTS idx_audit_at ON audit_log(at);
CREATE INDEX IF NOT EXISTS idx_attendance_class_day ON pupil_attendance(class_id, day);
CREATE INDEX IF NOT EXISTS idx_receipts_number ON receipts(number);

CREATE TRIGGER IF NOT EXISTS audit_log_no_update BEFORE UPDATE ON audit_log
BEGIN
  SELECT RAISE(ABORT, 'audit log is immutable');
END;
CREATE TRIGGER IF NOT EXISTS audit_log_no_delete BEFORE DELETE ON audit_log
BEGIN
  SELECT RAISE(ABORT, 'audit log is immutable');
END;
`;
