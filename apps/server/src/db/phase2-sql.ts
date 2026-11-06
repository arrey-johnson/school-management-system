export const PHASE2_SQL = `
CREATE TABLE IF NOT EXISTS classes (
  id TEXT PRIMARY KEY,
  academic_year_id TEXT NOT NULL REFERENCES academic_years(id),
  level_id TEXT NOT NULL REFERENCES levels(id),
  stream TEXT,
  capacity INTEGER NOT NULL DEFAULT 40,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  created_by TEXT,
  updated_by TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS classes_year_level_stream
  ON classes(academic_year_id, level_id, COALESCE(stream, ''));

CREATE TABLE IF NOT EXISTS subjects (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  archived_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS class_subjects (
  id TEXT PRIMARY KEY,
  class_id TEXT NOT NULL REFERENCES classes(id),
  subject_id TEXT NOT NULL REFERENCES subjects(id),
  coefficient INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS class_subjects_unique ON class_subjects(class_id, subject_id);

CREATE TABLE IF NOT EXISTS grading_scales (
  id TEXT PRIMARY KEY,
  section_id TEXT NOT NULL REFERENCES sections(id),
  score_out_of INTEGER NOT NULL,
  pass_mark INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS grading_scale_bands (
  id TEXT PRIMARY KEY,
  scale_id TEXT NOT NULL REFERENCES grading_scales(id),
  min_score INTEGER NOT NULL,
  max_score INTEGER NOT NULL,
  letter TEXT NOT NULL,
  remark TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS applications (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  given_name TEXT NOT NULL,
  family_name TEXT NOT NULL,
  sex TEXT NOT NULL,
  dob TEXT NOT NULL,
  place_of_birth TEXT,
  nationality TEXT,
  previous_school TEXT,
  level_id TEXT NOT NULL REFERENCES levels(id),
  notes TEXT,
  guardian_given_name TEXT NOT NULL,
  guardian_family_name TEXT NOT NULL,
  guardian_phone TEXT NOT NULL,
  guardian_email TEXT,
  guardian_relationship TEXT NOT NULL,
  pupil_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  created_by TEXT,
  updated_by TEXT
);

CREATE TABLE IF NOT EXISTS pupils (
  id TEXT PRIMARY KEY,
  admission_number TEXT NOT NULL UNIQUE,
  given_name TEXT NOT NULL,
  family_name TEXT NOT NULL,
  sex TEXT NOT NULL,
  dob TEXT NOT NULL,
  place_of_birth TEXT,
  nationality TEXT,
  address TEXT,
  medical_notes TEXT,
  previous_school TEXT,
  application_id TEXT,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  created_by TEXT,
  updated_by TEXT
);
CREATE INDEX IF NOT EXISTS pupils_name_dob ON pupils(family_name, given_name, dob);

CREATE TABLE IF NOT EXISTS pupil_status_history (
  id TEXT PRIMARY KEY,
  pupil_id TEXT NOT NULL REFERENCES pupils(id),
  status TEXT NOT NULL,
  reason TEXT,
  at TEXT NOT NULL,
  actor_user_id TEXT
);

CREATE TABLE IF NOT EXISTS guardians (
  id TEXT PRIMARY KEY,
  given_name TEXT NOT NULL,
  family_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  phone2 TEXT,
  email TEXT,
  occupation TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS guardians_phone ON guardians(phone);

CREATE TABLE IF NOT EXISTS pupil_guardians (
  pupil_id TEXT NOT NULL REFERENCES pupils(id),
  guardian_id TEXT NOT NULL REFERENCES guardians(id),
  relationship TEXT NOT NULL,
  primary_contact INTEGER NOT NULL DEFAULT 0,
  fee_payer INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS pupil_guardians_pk ON pupil_guardians(pupil_id, guardian_id);

CREATE TABLE IF NOT EXISTS promotion_batches (
  id TEXT PRIMARY KEY,
  source_class_id TEXT NOT NULL,
  target_class_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  created_by TEXT,
  undone_at TEXT
);

CREATE TABLE IF NOT EXISTS enrolments (
  id TEXT PRIMARY KEY,
  pupil_id TEXT NOT NULL REFERENCES pupils(id),
  academic_year_id TEXT NOT NULL REFERENCES academic_years(id),
  class_id TEXT NOT NULL REFERENCES classes(id),
  placement_type TEXT NOT NULL,
  promotion_batch_id TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS enrolments_pupil_year ON enrolments(pupil_id, academic_year_id);

CREATE TABLE IF NOT EXISTS discipline_notes (
  id TEXT PRIMARY KEY,
  pupil_id TEXT NOT NULL REFERENCES pupils(id),
  note TEXT NOT NULL,
  at TEXT NOT NULL,
  created_by TEXT
);
`;
