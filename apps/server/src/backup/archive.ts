import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { gunzipSync, gzipSync } from "node:zlib";
import { httpError } from "../utils/http-error.js";

export type BackupManifest = {
  format: "SMSBK1";
  appVersion: string;
  createdAt: string;
  dbSha256: string;
  dbBytes: number;
  counts: Record<string, number>;
  integrity: string;
  files: { name: string; bytes: number }[];
};

const MAGIC = Buffer.from("SMSBK1\n");

export function sha256(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

export function backupsDir(dataDir: string): string {
  return path.join(dataDir, "backups");
}

export function uploadsDir(dataDir: string): string {
  return path.join(dataDir, "uploads");
}

export function safeBackupFilename(filename: string): string {
  const base = path.basename(filename);
  if (!/^sms-[A-Za-z0-9._-]+\.sms-backup$/.test(base)) {
    throw httpError(400, "VALIDATION", "Invalid backup filename");
  }
  return base;
}

function walkFiles(root: string, rel = ""): { name: string; data: Buffer }[] {
  const dir = path.join(root, rel);
  if (!fs.existsSync(dir)) return [];
  const out: { name: string; data: Buffer }[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const childRel = rel ? `${rel}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      out.push(...walkFiles(root, childRel));
    } else if (entry.isFile()) {
      out.push({ name: childRel, data: fs.readFileSync(path.join(root, childRel)) });
    }
  }
  return out;
}

export function collectUploads(dataDir: string): { name: string; data: Buffer }[] {
  return walkFiles(uploadsDir(dataDir));
}

export function packBackup(manifest: BackupManifest, db: Buffer, files: { name: string; data: Buffer }[]): Buffer {
  const index = Buffer.from(JSON.stringify({ ...manifest, files: files.map((f) => ({ name: f.name, bytes: f.data.length })) }), "utf8");
  const header = Buffer.alloc(8);
  header.writeUInt32BE(index.length, 0);
  header.writeUInt32BE(db.length, 4);
  const parts = [MAGIC, header, index, db];
  for (const file of files) {
    const nameBuf = Buffer.from(file.name, "utf8");
    const meta = Buffer.alloc(8);
    meta.writeUInt32BE(nameBuf.length, 0);
    meta.writeUInt32BE(file.data.length, 4);
    parts.push(meta, nameBuf, file.data);
  }
  return gzipSync(Buffer.concat(parts), { level: 6 });
}

export function unpackBackup(archive: Buffer): { manifest: BackupManifest; db: Buffer; files: { name: string; data: Buffer }[] } {
  const raw = gunzipSync(archive);
  if (raw.subarray(0, MAGIC.length).toString() !== MAGIC.toString()) {
    throw httpError(400, "VALIDATION", "Not a Promptstack backup");
  }
  const header = raw.subarray(MAGIC.length, MAGIC.length + 8);
  const indexLen = header.readUInt32BE(0);
  const dbLen = header.readUInt32BE(4);
  let offset = MAGIC.length + 8;
  const manifest = JSON.parse(raw.subarray(offset, offset + indexLen).toString("utf8")) as BackupManifest;
  offset += indexLen;
  const db = Buffer.from(raw.subarray(offset, offset + dbLen));
  offset += dbLen;
  if (sha256(db) !== manifest.dbSha256) {
    throw httpError(400, "VALIDATION", "Backup checksum mismatch");
  }
  const files: { name: string; data: Buffer }[] = [];
  while (offset < raw.length) {
    const nameLen = raw.readUInt32BE(offset);
    const dataLen = raw.readUInt32BE(offset + 4);
    offset += 8;
    const name = raw.subarray(offset, offset + nameLen).toString("utf8");
    offset += nameLen;
    if (name.includes("..") || path.isAbsolute(name)) {
      throw httpError(400, "VALIDATION", "Backup contains an unsafe path");
    }
    const data = Buffer.from(raw.subarray(offset, offset + dataLen));
    offset += dataLen;
    files.push({ name, data });
  }
  return { manifest, db, files };
}

export function writeUploads(dataDir: string, files: { name: string; data: Buffer }[]): void {
  const root = uploadsDir(dataDir);
  fs.rmSync(root, { recursive: true, force: true });
  fs.mkdirSync(root, { recursive: true });
  for (const file of files) {
    const dest = path.join(root, file.name);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, file.data);
  }
}
