import {
  leaveCreateSchema,
  staffAssignmentSchema,
  staffAttendanceSchema,
  staffCreateSchema,
  staffStatusSchema,
} from "@sms/shared";
import { z } from "zod";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import type { AppContext } from "../../app-context.js";
import { writeAudit } from "../../audit/service.js";
import { assertCsrf } from "../../auth/csrf.js";
import { requirePermission, requireUser, resolveSession } from "../../auth/session.js";
import { leaves, staff, staffAssignments, staffAttendance, staffStatusHistory } from "../../db/schema.js";
import { httpError } from "../../utils/http-error.js";
import {
  assignStaff,
  createStaff,
  decideLeave,
  markAttendance,
  redactStaff,
  requestLeave,
  setStaffStatus,
} from "./service.js";

function canSeeNationalId(roleSlug: string, permissions: string[]): boolean {
  return roleSlug === "super_admin" || permissions.includes("staff:national_id");
}

export function registerStaffRoutes(app: FastifyInstance, ctx: AppContext): void {
  app.get("/api/v1/staff", async (req) => {
    const user = requireUser(resolveSession(ctx.bundle, req));
    requirePermission(user, "staff:read");
    const seeId = canSeeNationalId(user.roleSlug, user.permissions);
    const rows = ctx.bundle.db.select().from(staff).all();
    return { items: rows.map((row) => redactStaff(row, seeId)) };
  });

  app.get("/api/v1/staff/:id", async (req) => {
    const user = requireUser(resolveSession(ctx.bundle, req));
    requirePermission(user, "staff:read");
    const { id } = req.params as { id: string };
    const row = ctx.bundle.db.select().from(staff).where(eq(staff.id, id)).get();
    if (!row) throw httpError(404, "NOT_FOUND", "Staff not found");
    return {
      staff: redactStaff(row, canSeeNationalId(user.roleSlug, user.permissions)),
      history: ctx.bundle.db.select().from(staffStatusHistory).where(eq(staffStatusHistory.staffId, id)).all(),
      assignments: ctx.bundle.db.select().from(staffAssignments).where(eq(staffAssignments.staffId, id)).all(),
    };
  });

  app.post("/api/v1/staff", async (req) => {
    assertCsrf(req);
    const user = requireUser(resolveSession(ctx.bundle, req));
    requirePermission(user, "staff:manage");
    const body = staffCreateSchema.parse(req.body);
    const created = createStaff(ctx.bundle, body, user.id);
    writeAudit(ctx.bundle.db, {
      actorUserId: user.id,
      ip: req.ip,
      module: "staff",
      action: "create",
      entity: "staff",
      entityId: created.id,
      after: { ...body, nationalId: body.nationalId ? "[redacted]" : "" },
    });
    return created;
  });

  app.post("/api/v1/staff/:id/status", async (req) => {
    assertCsrf(req);
    const user = requireUser(resolveSession(ctx.bundle, req));
    requirePermission(user, "staff:manage");
    const { id } = req.params as { id: string };
    const body = staffStatusSchema.parse(req.body);
    setStaffStatus(ctx.bundle, id, body.status, body.reason, user.id);
    return { ok: true };
  });

  app.post("/api/v1/staff/assignments", async (req) => {
    assertCsrf(req);
    const user = requireUser(resolveSession(ctx.bundle, req));
    requirePermission(user, "staff:manage");
    const body = staffAssignmentSchema.parse(req.body);
    return assignStaff(ctx.bundle, body, user.id);
  });

  app.get("/api/v1/leaves", async (req) => {
    const user = requireUser(resolveSession(ctx.bundle, req));
    requirePermission(user, "staff:read");
    return { items: ctx.bundle.db.select().from(leaves).all() };
  });

  app.post("/api/v1/leaves", async (req) => {
    assertCsrf(req);
    const user = requireUser(resolveSession(ctx.bundle, req));
    requirePermission(user, "staff:manage");
    const body = leaveCreateSchema.parse(req.body);
    return requestLeave(ctx.bundle, body, user.id);
  });

  app.post("/api/v1/leaves/:id/decide", async (req) => {
    assertCsrf(req);
    const user = requireUser(resolveSession(ctx.bundle, req));
    requirePermission(user, "staff:manage");
    const { id } = req.params as { id: string };
    const parsed = z.object({ decision: z.enum(["approved", "rejected"]) }).parse(req.body);
    decideLeave(ctx.bundle, id, parsed.decision);
    return { ok: true };
  });

  app.post("/api/v1/staff/attendance", async (req) => {
    assertCsrf(req);
    const user = requireUser(resolveSession(ctx.bundle, req));
    requirePermission(user, "staff:manage");
    const body = staffAttendanceSchema.parse(req.body);
    return markAttendance(ctx.bundle, body, user.id);
  });

  app.get("/api/v1/staff/attendance", async (req) => {
    const user = requireUser(resolveSession(ctx.bundle, req));
    requirePermission(user, "staff:read");
    return { items: ctx.bundle.db.select().from(staffAttendance).all() };
  });
}
