import fs from "node:fs";
import os from "node:os";
import { APP_VERSION, paginationQuerySchema } from "@sms/shared";
import { desc } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import type { AppContext } from "../../app-context.js";
import { verifyAuditChain } from "../../audit/service.js";
import { requirePermission, requireUser, resolveSession } from "../../auth/session.js";
import { auditLog, schoolProfile } from "../../db/schema.js";
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
    return { school: school ?? null };
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
