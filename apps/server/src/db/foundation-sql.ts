export const FOUNDATION_SQL = `
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;
PRAGMA synchronous = FULL;
PRAGMA busy_timeout = 5000;

CREATE TABLE IF NOT EXISTS school_profile (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  school_kind TEXT NOT NULL DEFAULT 'combined',
  motto TEXT,
  address TEXT,
  phone TEXT,
  email TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  created_by TEXT,
  updated_by TEXT
);

CREATE TABLE IF NOT EXISTS academic_years (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  created_by TEXT,
  updated_by TEXT
);

CREATE TABLE IF NOT EXISTS terms (
  id TEXT PRIMARY KEY,
  academic_year_id TEXT NOT NULL REFERENCES academic_years(id),
  sequence INTEGER NOT NULL,
  name TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sections (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  archived_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS levels (
  id TEXT PRIMARY KEY,
  section_id TEXT NOT NULL REFERENCES sections(id),
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS roles (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  is_system INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS permissions (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id TEXT NOT NULL REFERENCES roles(id),
  permission_id TEXT NOT NULL REFERENCES permissions(id)
);
CREATE UNIQUE INDEX IF NOT EXISTS role_permissions_pk ON role_permissions(role_id, permission_id);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  role_id TEXT NOT NULL REFERENCES roles(id),
  locale TEXT NOT NULL DEFAULT 'en',
  must_change_password INTEGER NOT NULL DEFAULT 1,
  disabled_at TEXT,
  failed_login_count INTEGER NOT NULL DEFAULT 0,
  locked_until TEXT,
  last_login_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  created_by TEXT,
  updated_by TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  token_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  ip TEXT,
  user_agent TEXT,
  revoked_at TEXT
);

CREATE TABLE IF NOT EXISTS login_attempts (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  success INTEGER NOT NULL,
  ip TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  at TEXT NOT NULL,
  actor_user_id TEXT,
  ip TEXT,
  workstation TEXT,
  module TEXT NOT NULL,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT,
  before_json TEXT,
  after_json TEXT,
  reason TEXT,
  prev_hash TEXT NOT NULL,
  row_hash TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT
);

CREATE TABLE IF NOT EXISTS number_sequences (
  name TEXT PRIMARY KEY,
  prefix TEXT NOT NULL,
  next_value INTEGER NOT NULL,
  padding INTEGER NOT NULL,
  updated_at TEXT NOT NULL
);
`;
