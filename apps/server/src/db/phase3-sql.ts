export const PHASE3_SQL = `
CREATE TABLE IF NOT EXISTS fee_items (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  amount_fcfa INTEGER NOT NULL,
  mandatory INTEGER NOT NULL DEFAULT 1,
  scope TEXT NOT NULL,
  academic_year_id TEXT NOT NULL REFERENCES academic_years(id),
  term_id TEXT,
  section_id TEXT,
  level_id TEXT,
  class_id TEXT,
  archived_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  created_by TEXT,
  updated_by TEXT
);

CREATE TABLE IF NOT EXISTS pupil_invoices (
  id TEXT PRIMARY KEY,
  pupil_id TEXT NOT NULL REFERENCES pupils(id),
  academic_year_id TEXT NOT NULL REFERENCES academic_years(id),
  created_at TEXT NOT NULL,
  created_by TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS pupil_invoices_year ON pupil_invoices(pupil_id, academic_year_id);

CREATE TABLE IF NOT EXISTS invoice_lines (
  id TEXT PRIMARY KEY,
  invoice_id TEXT NOT NULL REFERENCES pupil_invoices(id),
  fee_item_id TEXT,
  description TEXT NOT NULL,
  amount_fcfa INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS adjustments (
  id TEXT PRIMARY KEY,
  invoice_line_id TEXT NOT NULL REFERENCES invoice_lines(id),
  type TEXT NOT NULL,
  amount_fcfa INTEGER NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL,
  approval_id TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT
);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  pupil_id TEXT NOT NULL REFERENCES pupils(id),
  invoice_id TEXT NOT NULL REFERENCES pupil_invoices(id),
  amount_fcfa INTEGER NOT NULL,
  unallocated_fcfa INTEGER NOT NULL DEFAULT 0,
  kind TEXT NOT NULL,
  channel TEXT NOT NULL,
  reference TEXT,
  payer_name TEXT NOT NULL,
  notes TEXT,
  entry_date TEXT NOT NULL,
  recorded_by TEXT NOT NULL,
  idempotency_key TEXT UNIQUE,
  original_payment_id TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS payment_allocations (
  id TEXT PRIMARY KEY,
  payment_id TEXT NOT NULL REFERENCES payments(id),
  invoice_line_id TEXT NOT NULL REFERENCES invoice_lines(id),
  amount_fcfa INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS receipts (
  id TEXT PRIMARY KEY,
  payment_id TEXT NOT NULL UNIQUE REFERENCES payments(id),
  number TEXT NOT NULL UNIQUE,
  verification_code TEXT NOT NULL,
  status TEXT NOT NULL,
  reprint_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reversals (
  id TEXT PRIMARY KEY,
  original_payment_id TEXT NOT NULL REFERENCES payments(id),
  reversal_payment_id TEXT REFERENCES payments(id),
  approval_id TEXT,
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL,
  created_by TEXT
);

CREATE TABLE IF NOT EXISTS approval_requests (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  payload_json TEXT,
  requested_by TEXT NOT NULL,
  decided_by TEXT,
  status TEXT NOT NULL,
  reason TEXT,
  created_at TEXT NOT NULL,
  decided_at TEXT
);

CREATE TABLE IF NOT EXISTS cash_ups (
  id TEXT PRIMARY KEY,
  cashier_user_id TEXT NOT NULL,
  day TEXT NOT NULL,
  totals_json TEXT NOT NULL,
  counted_cash_fcfa INTEGER NOT NULL,
  notes TEXT,
  locked_at TEXT NOT NULL,
  locked_by TEXT NOT NULL,
  reopen_approval_id TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS cash_ups_cashier_day ON cash_ups(cashier_user_id, day);

CREATE TABLE IF NOT EXISTS period_locks (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  key TEXT NOT NULL,
  locked_at TEXT NOT NULL,
  locked_by TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS period_locks_kind_key ON period_locks(kind, key);

CREATE TABLE IF NOT EXISTS idempotency_keys (
  key TEXT PRIMARY KEY,
  request_hash TEXT NOT NULL,
  response_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);
`;
