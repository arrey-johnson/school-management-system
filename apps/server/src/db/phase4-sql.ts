export const PHASE4_SQL = `
CREATE TABLE IF NOT EXISTS staff (
  id TEXT PRIMARY KEY,
  given_name TEXT NOT NULL,
  family_name TEXT NOT NULL,
  sex TEXT NOT NULL,
  dob TEXT,
  national_id TEXT,
  phone TEXT NOT NULL,
  email TEXT,
  address TEXT,
  department TEXT,
  position TEXT NOT NULL,
  employment_type TEXT NOT NULL,
  hire_date TEXT NOT NULL,
  emergency_contact TEXT,
  user_id TEXT,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  created_by TEXT,
  updated_by TEXT
);

CREATE TABLE IF NOT EXISTS staff_status_history (
  id TEXT PRIMARY KEY,
  staff_id TEXT NOT NULL REFERENCES staff(id),
  status TEXT NOT NULL,
  reason TEXT,
  at TEXT NOT NULL,
  actor_user_id TEXT
);

CREATE TABLE IF NOT EXISTS staff_assignments (
  id TEXT PRIMARY KEY,
  staff_id TEXT NOT NULL REFERENCES staff(id),
  academic_year_id TEXT NOT NULL,
  role TEXT NOT NULL,
  class_id TEXT,
  class_subject_id TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT
);

CREATE TABLE IF NOT EXISTS leaves (
  id TEXT PRIMARY KEY,
  staff_id TEXT NOT NULL REFERENCES staff(id),
  type TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  reason TEXT,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  created_by TEXT
);

CREATE TABLE IF NOT EXISTS staff_attendance (
  id TEXT PRIMARY KEY,
  staff_id TEXT NOT NULL REFERENCES staff(id),
  day TEXT NOT NULL,
  mark TEXT NOT NULL,
  created_at TEXT NOT NULL,
  created_by TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS staff_attendance_day ON staff_attendance(staff_id, day);

CREATE TABLE IF NOT EXISTS salary_component_types (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  mode TEXT NOT NULL,
  statutory INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS salary_structures (
  id TEXT PRIMARY KEY,
  staff_id TEXT NOT NULL REFERENCES staff(id),
  base_fcfa INTEGER NOT NULL,
  effective_from TEXT NOT NULL,
  created_at TEXT NOT NULL,
  created_by TEXT
);

CREATE TABLE IF NOT EXISTS salary_structure_lines (
  id TEXT PRIMARY KEY,
  structure_id TEXT NOT NULL REFERENCES salary_structures(id),
  component_type_id TEXT NOT NULL REFERENCES salary_component_types(id),
  value INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS advances_loans (
  id TEXT PRIMARY KEY,
  staff_id TEXT NOT NULL REFERENCES staff(id),
  principal_fcfa INTEGER NOT NULL,
  remaining_fcfa INTEGER NOT NULL,
  installment_fcfa INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  created_by TEXT
);

CREATE TABLE IF NOT EXISTS payroll_runs (
  id TEXT PRIMARY KEY,
  year_month TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL,
  prepared_by TEXT,
  approved_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS payroll_lines (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES payroll_runs(id),
  staff_id TEXT NOT NULL,
  snapshot_json TEXT NOT NULL,
  gross_fcfa INTEGER NOT NULL,
  deductions_fcfa INTEGER NOT NULL,
  net_fcfa INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS payslips (
  id TEXT PRIMARY KEY,
  payroll_line_id TEXT NOT NULL UNIQUE REFERENCES payroll_lines(id),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS expense_categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY,
  category_id TEXT NOT NULL REFERENCES expense_categories(id),
  entry_date TEXT NOT NULL,
  amount_fcfa INTEGER NOT NULL,
  description TEXT NOT NULL,
  vendor TEXT,
  method TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  created_by TEXT,
  decided_by TEXT
);

CREATE TABLE IF NOT EXISTS budgets (
  id TEXT PRIMARY KEY,
  category_id TEXT NOT NULL REFERENCES expense_categories(id),
  academic_year_id TEXT NOT NULL,
  amount_fcfa INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS budgets_category_year ON budgets(category_id, academic_year_id);
`;
