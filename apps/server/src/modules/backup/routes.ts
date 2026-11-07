import { restoreBackupSchema } from "@sms/shared";
import type { FastifyInstance } from "fastify";
import type { AppContext } from "../../app-context.js";
import { writeAudit } from "../../audit/service.js";
import { assertCsrf } from "../../auth/csrf.js";
import { requirePermission, requireUser, resolveSession } from "../../auth/session.js";
import { createBackup, listBackups, restoreBackup, validateArchive } from "./service.js";

export function registerBackupRoutes(app: FastifyInstance, ctx: AppContext): void {
  app.get("/api/v1/backups", async (req) => {
    const user = requireUser(resolveSession(ctx.bundle, req));
    requirePermission(user, "system:backup");
    return { items: listBackups(ctx.bundle) };
  });

  app.post("/api/v1/backups", async (req) => {
    assertCsrf(req);
    const user = requireUser(resolveSession(ctx.bundle, req));
    requirePermission(user, "system:backup");
    const created = await createBackup(ctx.bundle, user.id, "manual");
    writeAudit(ctx.bundle.db, {
      actorUserId: user.id,
      ip: req.ip,
      module: "backup",
      action: "create",
      entity: "backup",
      entityId: created.id,
      after: { filename: created.filename, integrity: created.integrity },
    });
    return created;
  });

  app.get("/api/v1/backups/:filename/validate", async (req) => {
    const user = requireUser(resolveSession(ctx.bundle, req));
    requirePermission(user, "system:backup");
    const { filename } = req.params as { filename: string };
    return validateArchive(ctx.bundle, filename);
  });

  app.post("/api/v1/backups/restore", async (req) => {
    assertCsrf(req);
    const user = requireUser(resolveSession(ctx.bundle, req));
    requirePermission(user, "system:backup");
    const body = restoreBackupSchema.parse(req.body);
    const result = await restoreBackup(ctx.bundle, body.filename, body.confirmation, user.id);
    writeAudit(ctx.bundle.db, {
      actorUserId: user.id,
      ip: req.ip,
      module: "backup",
      action: "restore",
      entity: "backup",
      entityId: body.filename,
      after: result,
      reason: "Confirmed restore",
    });
    return result;
  });
}
