import fs from "node:fs";
import os from "node:os";
import { APP_VERSION, paginationQuerySchema, resolveSchoolKind, schoolProfileSchema } from "@sms/shared";
import { desc, eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import type { AppContext } from "../../app-context.js";
import { verifyAuditChain, writeAudit } from "../../audit/service.js";
import { assertCsrf } from "../../auth/csrf.js";
import { requirePermission, requireUser, resolveSession } from "../../auth/session.js";
import { auditLog, schoolProfile } from "../../db/schema.js";
import { httpError } from "../../utils/http-error.js";
import { ensureDefaultSections } from "../academic/structure.js";
import { backupHealth, diskFreeBytes, liveIntegrity } from "../backup/service.js";
import { lanQrSvg } from "../../utils/qr.js";
import { openApiDocument } from "./openapi.js";

export function registerSystemRoutes(app: FastifyInstance, ctx: AppContext): void {
  app.get("/api/v1/system/health", async (req) => {
    const user = requireUser(resolveSession(ctx.bundle, req));
    requirePermission(user, "system:health");
    const stat = fs.existsSync(ctx.bundle.dbPath) ? fs.statSync(ctx.bundle.dbPath) : null;
    const backup = backupHealth(ctx.bundle);
    return {
      version: APP_VERSION,
      uptimeSeconds: Math.round((Date.now() - ctx.startedAt) / 1000),
      dbBytes: stat?.size ?? 0,
      hostname: os.hostname(),
      port: ctx.env.SMS_PORT,
      diskFreeBytes: diskFreeBytes(ctx.bundle.dataDir),
      integrity: liveIntegrity(ctx.bundle),
      inDocker: fs.existsSync("/.dockerenv"),
      ...backup,
    };
  });

  app.get("/api/docs", async (req) => {
    const user = requireUser(resolveSession(ctx.bundle, req));
    requirePermission(user, "system:openapi");
    return openApiDocument();
  });

  app.get("/api/v1/system/status", async (req) => {
    const user = requireUser(resolveSession(ctx.bundle, req));
    requirePermission(user, "system:health");
    const nets = os.networkInterfaces();
    const ips: string[] = [];
    for (const addrs of Object.values(nets)) {
      for (const addr of addrs ?? []) {
        if (addr.family === "IPv4" && !addr.internal) ips.push(addr.address);
      }
    }
    const school = ctx.bundle.db.select().from(schoolProfile).get();
    const url = `http://${ips[0] ?? "localhost"}:${ctx.env.SMS_PORT}`;
    return {
      schoolName: school?.name ?? null,
      hostname: os.hostname(),
      ips,
      url,
      version: APP_VERSION,
      inDocker: fs.existsSync("/.dockerenv"),
      qrSvg: await lanQrSvg(url),
    };
  });

  app.get("/api/v1/branding", async () => {
    const school = ctx.bundle.db.select().from(schoolProfile).get();
    return { schoolName: school?.name ?? null };
  });

  app.get("/api/v1/school", async (req) => {
    const user = requireUser(resolveSession(ctx.bundle, req));
    requirePermission(user, "school:read");
    const school = ctx.bundle.db.select().from(schoolProfile).get();
    if (!school) return { school: null };
    return {
      school: {
        id: school.id,
        name: school.name,
        schoolKind: resolveSchoolKind(school.schoolKind),
        motto: school.motto,
        address: school.address,
        phone: school.phone,
        email: school.email,
      },
    };
  });

  app.patch("/api/v1/school", async (req) => {
    assertCsrf(req);
    const user = requireUser(resolveSession(ctx.bundle, req));
    requirePermission(user, "school:update");
    const body = schoolProfileSchema.parse(req.body);
    const existing = ctx.bundle.db.select().from(schoolProfile).get();
    if (!existing) throw httpError(400, "VALIDATION", "School profile is required");
    const at = new Date().toISOString();
    const before = {
      name: existing.name,
      schoolKind: resolveSchoolKind(existing.schoolKind),
      motto: existing.motto,
      address: existing.address,
      phone: existing.phone,
      email: existing.email,
    };
    ctx.bundle.sqlite.transaction(() => {
      ctx.bundle.db
        .update(schoolProfile)
        .set({
          name: body.name,
          schoolKind: body.schoolKind,
          motto: body.motto === undefined ? existing.motto : body.motto || null,
          address: body.address === undefined ? existing.address : body.address || null,
          phone: body.phone === undefined ? existing.phone : body.phone || null,
          email: body.email === undefined ? existing.email : body.email || null,
          updatedAt: at,
          updatedBy: user.id,
        })
        .where(eq(schoolProfile.id, existing.id))
        .run();
      ensureDefaultSections(ctx.bundle.db, body.schoolKind, at);
    })();
    writeAudit(ctx.bundle.db, {
      actorUserId: user.id,
      ip: req.ip,
      module: "school",
      action: "update",
      entity: "school_profile",
      entityId: existing.id,
      before,
      after: body,
    });
    return { ok: true };
  });

  app.get("/api/v1/audit", async (req) => {
    const user = requireUser(resolveSession(ctx.bundle, req));
    requirePermission(user, "system:audit");
    const query = paginationQuerySchema.parse(req.query);
    const rows = ctx.bundle.db.select().from(auditLog).orderBy(desc(auditLog.at)).all();
    const start = (query.page - 1) * query.pageSize;
    return {
      items: rows.slice(start, start + query.pageSize),
      total: rows.length,
      page: query.page,
      pageSize: query.pageSize,
    };
  });

  app.post("/api/v1/audit/verify", async (req) => {
    const user = requireUser(resolveSession(ctx.bundle, req));
    requirePermission(user, "system:audit:verify");
    return verifyAuditChain(ctx.bundle.db);
  });
}
