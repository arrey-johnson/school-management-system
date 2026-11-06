import { GENESIS_HASH, hashAuditRow } from "@sms/shared/audit";
import { createId } from "@sms/shared";
import { desc } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { auditLog } from "../db/schema.js";

export type AuditWrite = {
  actorUserId: string | null;
  ip?: string;
  workstation?: string;
  module: string;
  action: string;
  entity: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  reason?: string | null;
};

export function writeAudit(db: Db, input: AuditWrite): void {
  const last = db.select().from(auditLog).orderBy(desc(auditLog.at), desc(auditLog.id)).get();
  const prevHash = last?.rowHash ?? GENESIS_HASH;
  const at = new Date().toISOString();
  const beforeJson = input.before === undefined ? null : JSON.stringify(input.before);
  const afterJson = input.after === undefined ? null : JSON.stringify(input.after);
  const rowHash = hashAuditRow({
    prevHash,
    at,
    actorUserId: input.actorUserId,
    module: input.module,
    action: input.action,
    entity: input.entity,
    entityId: input.entityId ?? null,
    beforeJson,
    afterJson,
    reason: input.reason ?? null,
  });
  db.insert(auditLog)
    .values({
      id: createId(),
      at,
      actorUserId: input.actorUserId,
      ip: input.ip ?? null,
      workstation: input.workstation ?? null,
      module: input.module,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId ?? null,
      beforeJson,
      afterJson,
      reason: input.reason ?? null,
      prevHash,
      rowHash,
    })
    .run();
}

export function verifyAuditChain(db: Db): { ok: boolean; checked: number; brokenAt?: string } {
  const rows = db.select().from(auditLog).orderBy(auditLog.at, auditLog.id).all();
  let prev = GENESIS_HASH;
  for (const row of rows) {
    if (row.prevHash !== prev) {
      return { ok: false, checked: rows.length, brokenAt: row.id };
    }
    const expected = hashAuditRow({
      prevHash: row.prevHash,
      at: row.at,
      actorUserId: row.actorUserId,
      module: row.module,
      action: row.action,
      entity: row.entity,
      entityId: row.entityId,
      beforeJson: row.beforeJson,
      afterJson: row.afterJson,
      reason: row.reason,
    });
    if (expected !== row.rowHash) {
      return { ok: false, checked: rows.length, brokenAt: row.id };
    }
    prev = row.rowHash;
  }
  return { ok: true, checked: rows.length };
}
