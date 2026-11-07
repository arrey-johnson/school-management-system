import { demoLoadSchema, demoResetSchema } from "@sms/shared";
import type { FastifyInstance } from "fastify";
import type { AppContext } from "../../app-context.js";
import { writeAudit } from "../../audit/service.js";
import { assertCsrf } from "../../auth/csrf.js";
import { requirePermission, requireUser, resolveSession } from "../../auth/session.js";
import { demoStatus, loadDemoData, resetDemoData } from "./service.js";

export function registerDemoRoutes(app: FastifyInstance, ctx: AppContext): void {
  app.get("/api/v1/system/demo", async (req) => {
    const user = requireUser(resolveSession(ctx.bundle, req));
    requirePermission(user, "system:demo");
    return demoStatus(ctx.bundle);
  });

  app.post("/api/v1/system/demo/load", async (req) => {
    assertCsrf(req);
    const user = requireUser(resolveSession(ctx.bundle, req));
    requirePermission(user, "system:demo");
    demoLoadSchema.parse(req.body);
    const result = await loadDemoData(ctx.bundle, user, ctx.env.SMS_TEST === "1");
    writeAudit(ctx.bundle.db, {
      actorUserId: user.id,
      ip: req.ip,
      module: "system",
      action: "demo_load",
      entity: "demo",
      after: result.counts,
      reason: "Loaded fictional demo data for testing",
    });
    return { ok: true, ...result };
  });

  app.post("/api/v1/system/demo/reset", async (req) => {
    assertCsrf(req);
    const user = requireUser(resolveSession(ctx.bundle, req));
    requirePermission(user, "system:demo");
    demoResetSchema.parse(req.body);
    const before = demoStatus(ctx.bundle);
    resetDemoData(ctx.bundle, user);
    writeAudit(ctx.bundle.db, {
      actorUserId: user.id,
      ip: req.ip,
      module: "system",
      action: "demo_reset",
      entity: "demo",
      before: before.counts,
      reason: "Removed fictional demo data before official use",
    });
    return { ok: true };
  });
}
