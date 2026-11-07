import type Database from "better-sqlite3";

export function ensurePhase8Columns(sqlite: Database.Database): void {
  const cols = sqlite.prepare("PRAGMA table_info(school_profile)").all() as Array<{ name: string }>;
  if (!cols.some((col) => col.name === "school_kind")) {
    sqlite.exec("ALTER TABLE school_profile ADD COLUMN school_kind TEXT NOT NULL DEFAULT 'combined'");
  }
}
