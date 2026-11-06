import { describe, expect, it } from "vitest";
import { GENESIS_HASH, hashAuditRow } from "./audit-hash.js";

describe("audit hash chain", () => {
  it("is deterministic and chains from genesis", () => {
    const row = {
      prevHash: GENESIS_HASH,
      at: "2026-01-01T00:00:00.000Z",
      actorUserId: "u1",
      module: "auth",
      action: "login",
      entity: "user",
      entityId: "u1",
      beforeJson: null,
      afterJson: "{}",
      reason: null,
    };
    const a = hashAuditRow(row);
    const b = hashAuditRow(row);
    expect(a).toBe(b);
    expect(a).toHaveLength(64);
    const next = hashAuditRow({ ...row, prevHash: a, action: "logout" });
    expect(next).not.toBe(a);
  });
});
