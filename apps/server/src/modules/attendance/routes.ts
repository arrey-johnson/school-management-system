import { attendanceSubmitSchema } from "@sms/shared";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { AppContext } from "../../app-context.js";
import { writeAudit } from "../../audit/service.js";
import { assertCsrf } from "../../auth/csrf.js";
import { requirePermission, requireUser, resolveSession } from "../../auth/session.js";
import { registerForDay, submitAttendance } from "./service.js";

export function registerAttendanceRoutes(app: FastifyInstance, ctx: AppContext): void {
  app.get("/api/v1/attendance", async (req) => {
    const user = requireUser(resolveSession(ctx.bundle, req));
    requirePermission(user, "attendance:read");
    const query = z.object({ classId: z.string().min(1), day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).parse(req.query);
    return registerForDay(ctx.bundle, query.classId, query.day, user);
  });

  app.post("/api/v1/attendance", async (req) => {
    assertCsrf(req);
    const user = requireUser(resolveSession(ctx.bundle, req));
    requirePermission(user, "attendance:submit");
    const body = attendanceSubmitSchema.parse(req.body);
    submitAttendance(ctx.bundle, body, user);
    writeAudit(ctx.bundle.db, {
      actorUserId: user.id,
      ip: req.ip,
      module: "attendance",
      action: "submit",
      entity: "pupil_attendance",
      entityId: body.classId,
      after: { day: body.day, count: body.entries.length },
    });
    return { ok: true };
  });
}
