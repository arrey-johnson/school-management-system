import {
  APP_VERSION,
  BACKUP_STALE_MS,
  createId,
  RESTORE_CONFIRMATION,
} from "@sms/shared";
import { desc, eq } from "drizzle-orm";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import type { DatabaseBundle } from "../../db/client.js";
import { reopenDatabase } from "../../db/client.js";
import { backups, driveQueue, settings } from "../../db/schema.js";
import {
  backupsDir,
  collectUploads,
  packBackup,
  safeBackupFilename,
  sha256,
  unpackBackup,
  writeUploads,
  type BackupManifest,
} from "../../backup/archive.js";
import { httpError } from "../../utils/http-error.js";

function nowIso(): string {
  return new Date().toISOString();
}

function setting(bundle: DatabaseBundle, key: string, fallback: string): string {
  return bundle.db.select().from(settings).where(eq(settings.key, key)).get()?.valueJson ?? fallback;
}

export function rowCounts(bundle: DatabaseBundle): Record<string, number> {
  const count = (table: string): number => {
    const row = bundle.sqlite.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number };
    return row.n;
  };
  return {
    pupils: count("pupils"),
    payments: count("payments"),
    staff: count("staff"),
    audit_log: count("audit_log"),
  };
}

async function snapshotLiveDb(bundle: DatabaseBundle, destPath: string): Promise<void> {
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  if (typeof bundle.sqlite.backup === "function") {
    await bundle.sqlite.backup(destPath);
    return;
  }
  bundle.sqlite.pragma("wal_checkpoint(TRUNCATE)");
  fs.copyFileSync(bundle.dbPath, destPath);
}

function integrityOf(dbPath: string): string {
  const db = new Database(dbPath, { readonly: true, fileMustExist: true });
  try {
    const row = db.prepare("PRAGMA integrity_check").get() as Record<string, string> | undefined;
    return row ? (Object.values(row)[0] ?? "unknown") : "unknown";
  } finally {
    db.close();
  }
}

function pruneOld(bundle: DatabaseBundle): void {
  const keep = Number(setting(bundle, "backup.keepLast", "14"));
  const dir = backupsDir(bundle.dataDir);
  const files = fs
    .readdirSync(dir)
    .filter((name) => name.endsWith(".sms-backup"))
    .map((name) => ({ name, mtime: fs.statSync(path.join(dir, name)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);
  for (const extra of files.slice(Number.isFinite(keep) ? Math.max(keep, 1) : 14)) {
    fs.unlinkSync(path.join(dir, extra.name));
    const row = bundle.db.select().from(backups).where(eq(backups.filename, extra.name)).get();
    if (row) bundle.db.delete(backups).where(eq(backups.id, row.id)).run();
  }
}

export async function createBackup(
  bundle: DatabaseBundle,
  actorUserId: string | null,
  kind: "manual" | "scheduled" | "safety",
): Promise<{ id: string; filename: string; checksum: string; integrity: string; stale: boolean }> {
  const stamp = nowIso().replace(/[:.]/g, "-");
  const filename = `sms-${stamp}.sms-backup`;
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "sms-bak-"));
  const snapPath = path.join(tmpDir, "app.db");
  try {
    await snapshotLiveDb(bundle, snapPath);
    const dbBuf = fs.readFileSync(snapPath);
    const integrity = integrityOf(snapPath);
    const files = collectUploads(bundle.dataDir);
    const manifest: BackupManifest = {
      format: "SMSBK1",
      appVersion: APP_VERSION,
      createdAt: nowIso(),
      dbSha256: sha256(dbBuf),
      dbBytes: dbBuf.length,
      counts: rowCounts(bundle),
      integrity,
      files: files.map((f) => ({ name: f.name, bytes: f.data.length })),
    };
    const packed = packBackup(manifest, dbBuf, files);
    const dest = path.join(backupsDir(bundle.dataDir), filename);
    fs.writeFileSync(dest, packed);
    const driveEnabled = setting(bundle, "backup.driveEnabled", "false") === "true";
    const driveStatus = driveEnabled ? "queued" : "skipped";
    const id = createId();
    bundle.db
      .insert(backups)
      .values({
        id,
        filename,
        checksum: manifest.dbSha256,
        bytes: packed.length,
        countsJson: JSON.stringify(manifest.counts),
        integrity,
        driveStatus,
        createdAt: manifest.createdAt,
        createdBy: actorUserId,
        kind,
      })
      .run();
    if (driveEnabled) {
      const at = nowIso();
      bundle.db
        .insert(driveQueue)
        .values({
          id: createId(),
          backupId: id,
          status: "queued",
          lastError: null,
          createdAt: at,
          updatedAt: at,
        })
        .run();
    }
    pruneOld(bundle);
    return { id, filename, checksum: manifest.dbSha256, integrity, stale: false };
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

export function listBackups(bundle: DatabaseBundle) {
  return bundle.db.select().from(backups).orderBy(desc(backups.createdAt)).all();
}

export function backupHealth(bundle: DatabaseBundle) {
  const last = bundle.db.select().from(backups).orderBy(desc(backups.createdAt)).get();
  const dir = backupsDir(bundle.dataDir);
  let fileAt: string | null = null;
  let fileName: string | null = null;
  if (fs.existsSync(dir)) {
    for (const name of fs.readdirSync(dir).filter((item) => item.endsWith(".sms-backup"))) {
      const mtime = fs.statSync(path.join(dir, name)).mtime;
      const iso = mtime.toISOString();
      if (!fileAt || iso > fileAt) {
        fileAt = iso;
        fileName = name;
      }
    }
  }
  const lastAt = last?.createdAt && fileAt ? (last.createdAt > fileAt ? last.createdAt : fileAt) : (last?.createdAt ?? fileAt);
  const ageMs = lastAt ? Date.now() - new Date(lastAt).getTime() : Number.POSITIVE_INFINITY;
  return {
    lastBackupAt: lastAt,
    lastIntegrity: last?.integrity ?? null,
    lastFilename: last?.filename ?? fileName,
    backupStale: ageMs > BACKUP_STALE_MS,
    driveEnabled: setting(bundle, "backup.driveEnabled", "false") === "true",
    queuedUploads: bundle.db
      .select()
      .from(driveQueue)
      .all()
      .filter((row) => row.status === "queued").length,
  };
}

export function validateArchive(bundle: DatabaseBundle, filename: string) {
  const safe = safeBackupFilename(filename);
  const full = path.join(backupsDir(bundle.dataDir), safe);
  if (!fs.existsSync(full)) throw httpError(404, "NOT_FOUND", "Backup file not found");
  const unpacked = unpackBackup(fs.readFileSync(full));
  const tmp = path.join(os.tmpdir(), `sms-val-${Date.now()}.db`);
  fs.writeFileSync(tmp, unpacked.db);
  try {
    const integrity = integrityOf(tmp);
    return {
      filename: safe,
      manifest: unpacked.manifest,
      integrity,
      currentCounts: rowCounts(bundle),
    };
  } finally {
    fs.unlinkSync(tmp);
  }
}

export async function restoreBackup(
  bundle: DatabaseBundle,
  filename: string,
  confirmation: string,
  actorUserId: string,
): Promise<{ ok: true; safetyFilename: string }> {
  if (confirmation !== RESTORE_CONFIRMATION) {
    throw httpError(400, "VALIDATION", `Type ${RESTORE_CONFIRMATION} to confirm`);
  }
  const preview = validateArchive(bundle, filename);
  const safety = await createBackup(bundle, actorUserId, "safety");
  const packed = fs.readFileSync(path.join(backupsDir(bundle.dataDir), preview.filename));
  const unpacked = unpackBackup(packed);
  const tmp = path.join(os.tmpdir(), `sms-restore-${Date.now()}.db`);
  fs.writeFileSync(tmp, unpacked.db);
  try {
    bundle.sqlite.close();
    fs.copyFileSync(tmp, bundle.dbPath);
    for (const ext of ["-wal", "-shm"]) {
      const side = `${bundle.dbPath}${ext}`;
      if (fs.existsSync(side)) fs.unlinkSync(side);
    }
    writeUploads(bundle.dataDir, unpacked.files);
    reopenDatabase(bundle);
  } catch (err) {
    try {
      reopenDatabase(bundle);
    } catch {
      /* still report original */
    }
    throw err;
  } finally {
    if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
  }
  return { ok: true, safetyFilename: safety.filename };
}

export function liveIntegrity(bundle: DatabaseBundle): string {
  const row = bundle.sqlite.prepare("PRAGMA integrity_check").get() as Record<string, string> | undefined;
  return row ? (Object.values(row)[0] ?? "unknown") : "unknown";
}

export function diskFreeBytes(dataDir: string): number | null {
  const statfs = (fs as typeof fs & { statfsSync?: (p: string) => { bavail: number; bsize: number } }).statfsSync;
  if (typeof statfs !== "function") return null;
  const info = statfs(dataDir);
  return info.bavail * info.bsize;
}
