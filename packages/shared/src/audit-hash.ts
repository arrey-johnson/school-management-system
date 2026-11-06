import { createHash } from "node:crypto";
import { GENESIS_HASH } from "./ids.js";

export type AuditHashInput = {
  prevHash: string;
  at: string;
  actorUserId: string | null;
  module: string;
  action: string;
  entity: string;
  entityId: string | null;
  beforeJson: string | null;
  afterJson: string | null;
  reason: string | null;
};

export function hashAuditRow(input: AuditHashInput): string {
  const canonical = JSON.stringify({
    prevHash: input.prevHash,
    at: input.at,
    actorUserId: input.actorUserId,
    module: input.module,
    action: input.action,
    entity: input.entity,
    entityId: input.entityId,
    beforeJson: input.beforeJson,
    afterJson: input.afterJson,
    reason: input.reason,
  });
  return createHash("sha256").update(canonical).digest("hex");
}

export { GENESIS_HASH };
