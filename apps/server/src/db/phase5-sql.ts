export const PHASE5_SQL = `
CREATE TABLE IF NOT EXISTS assessment_types (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  term_id TEXT NOT NULL,
  weight INTEGER NOT NULL,
  max_score INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  created_by TEXT
);

CREATE TABLE IF NOT EXISTS assessments (
  id TEXT PRIMARY KEY,
  type_id TEXT NOT NULL REFERENCES assessment_types(id),
  class_subject_id TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  submitted_at TEXT,
  submitted_by TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS assessments_type_class_subject ON assessments(type_id, class_subject_id);

CREATE TABLE IF NOT EXISTS marks (
  id TEXT PRIMARY KEY,
  assessment_id TEXT NOT NULL REFERENCES assessments(id),
  pupil_id TEXT NOT NULL,
  score REAL,
  status TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS marks_assessment_pupil ON marks(assessment_id, pupil_id);

CREATE TABLE IF NOT EXISTS term_results (
  id TEXT PRIMARY KEY,
  class_id TEXT NOT NULL,
  term_id TEXT NOT NULL,
  snapshot_json TEXT NOT NULL,
  computed_at TEXT NOT NULL,
  computed_by TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS term_results_class_term ON term_results(class_id, term_id);

CREATE TABLE IF NOT EXISTS report_cards (
  id TEXT PRIMARY KEY,
  pupil_id TEXT NOT NULL,
  term_id TEXT NOT NULL,
  withheld INTEGER NOT NULL DEFAULT 0,
  verification_code TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS report_cards_pupil_term ON report_cards(pupil_id, term_id);

CREATE TABLE IF NOT EXISTS pupil_attendance (
  id TEXT PRIMARY KEY,
  class_id TEXT NOT NULL,
  pupil_id TEXT NOT NULL,
  day TEXT NOT NULL,
  mark TEXT NOT NULL,
  reason TEXT,
  submitted INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  created_by TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS pupil_attendance_unique ON pupil_attendance(class_id, pupil_id, day);
`;
