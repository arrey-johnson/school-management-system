import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { FOUNDATION_SQL } from "./foundation-sql.js";
import { PHASE2_SQL } from "./phase2-sql.js";
import { PHASE3_SQL } from "./phase3-sql.js";
import { PHASE4_SQL } from "./phase4-sql.js";
import { PHASE5_SQL } from "./phase5-sql.js";
import { PHASE6_SQL } from "./phase6-sql.js";
import { PHASE7_SQL } from "./phase7-sql.js";
import { ensurePhase8Columns } from "./phase8-sql.js";
import * as schema from "./schema.js";

export type Db = BetterSQLite3Database<typeof schema>;

export type DatabaseBundle = {
  sqlite: Database.Database;
  db: Db;
  dbPath: string;
  dataDir: string;
};

function applyPragmasAndSchema(sqlite: Database.Database): void {
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("synchronous = FULL");
  sqlite.pragma("busy_timeout = 5000");
  sqlite.exec(FOUNDATION_SQL);
  sqlite.exec(PHASE2_SQL);
  sqlite.exec(PHASE3_SQL);
  sqlite.exec(PHASE4_SQL);
  sqlite.exec(PHASE5_SQL);
  sqlite.exec(PHASE6_SQL);
  sqlite.exec(PHASE7_SQL);
  ensurePhase8Columns(sqlite);
}

export function openDatabase(dataDir: string): DatabaseBundle {
  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(path.join(dataDir, "uploads"), { recursive: true });
  fs.mkdirSync(path.join(dataDir, "backups"), { recursive: true });
  fs.mkdirSync(path.join(dataDir, "logs"), { recursive: true });
  const dbPath = path.join(dataDir, "app.db");
  const sqlite = new Database(dbPath);
  applyPragmasAndSchema(sqlite);
  const db = drizzle(sqlite, { schema });
  return { sqlite, db, dbPath, dataDir };
}

export function reopenDatabase(bundle: DatabaseBundle): void {
  bundle.sqlite.close();
  const next = openDatabase(bundle.dataDir);
  bundle.sqlite = next.sqlite;
  bundle.db = next.db;
  bundle.dbPath = next.dbPath;
}
