import { applicationCreateSchema, applicationStatusSchema, createId } from "@sms/shared";
import { desc, eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { AppContext } from "../../app-context.js";
import { writeAudit } from "../../audit/service.js";
import { assertCsrf } from "../../auth/csrf.js";
import { requirePermission, requireUser, resolveSession } from "../../auth/session.js";
import { applications, classes, levels } from "../../db/schema.js";
import { httpError } from "../../utils/http-error.js";
import { createEnrolledPupil } from "../pupils/service.js";

export function registerAdmissionRoutes(app: FastifyInstance, ctx: AppContext): void {
  app.get("/api/v1/applications", async (req) => {
    const user = requireUser(resolveSession(ctx.bundle, req));
    requirePermission(user, "admissions:read");
    const rows = ctx.bundle.db.select().from(applications).orderBy(desc(applications.createdAt)).all();
    const levelRows = ctx.bundle.db.select().from(levels).all();
    return {
      items: rows.map((row) => ({
        ...row,
        levelName: levelRows.find((l) => l.id === row.levelId)?.name ?? "",
      })),
    };
  });

  app.post("/api/v1/applications", async (req) => {
    assertCsrf(req);
    const user = requireUser(resolveSession(ctx.bundle, req));
    requirePermission(user, "admissions:manage");
    const body = applicationCreateSchema.parse(req.body);
    const level = ctx.bundle.db.select().from(levels).where(eq(levels.id, body.levelId)).get();
    if (!level) throw httpError(400, "VALIDATION", "Unknown level");
    const id = createId();
    const at = new Date().toISOString();
    ctx.bundle.db
      .insert(applications)
      .values({
        id,
        status: "applied",
        givenName: body.givenName,
        familyName: body.familyName,
        sex: body.sex,
        dob: body.dob,
        placeOfBirth: body.placeOfBirth || null,
        nationality: body.nationality || null,
        previousSchool: body.previousSchool || null,
        levelId: body.levelId,
        notes: body.notes || null,
        guardianGivenName: body.guardian.givenName,
        guardianFamilyName: body.guardian.familyName,
        guardianPhone: body.guardian.phone,
        guardianEmail: body.guardian.email || null,
        guardianRelationship: body.guardian.relationship,
        createdAt: at,
        updatedAt: at,
        createdBy: user.id,
        updatedBy: user.id,
      })
      .run();
    writeAudit(ctx.bundle.db, {
      actorUserId: user.id,
      ip: req.ip,
      module: "admissions",
      action: "create",
      entity: "application",
      entityId: id,
      after: { givenName: body.givenName, familyName: body.familyName },
    });
    return { id };
  });

  app.post("/api/v1/applications/:id/status", async (req) => {
    assertCsrf(req);
    const user = requireUser(resolveSession(ctx.bundle, req));
    requirePermission(user, "admissions:manage");
    const { id } = req.params as { id: string };
    const body = applicationStatusSchema.parse(req.body);
    const row = ctx.bundle.db.select().from(applications).where(eq(applications.id, id)).get();
    if (!row) throw httpError(404, "NOT_FOUND", "Application not found");
    if (row.status === "enrolled") throw httpError(409, "CONFLICT", "Already enrolled");
    const allowed: Record<string, string[]> = {
      applied: ["under_review", "rejected", "waitlisted"],
      under_review: ["accepted", "rejected", "waitlisted"],
      waitlisted: ["under_review", "accepted", "rejected"],
      accepted: ["waitlisted", "rejected"],
      rejected: ["under_review"],
    };
    if (!allowed[row.status]?.includes(body.status)) {
      throw httpError(409, "CONFLICT", `Cannot move from ${row.status} to ${body.status}`);
    }
    ctx.bundle.db
      .update(applications)
      .set({
        status: body.status,
        notes: body.reason || row.notes,
        updatedAt: new Date().toISOString(),
        updatedBy: user.id,
      })
      .where(eq(applications.id, id))
      .run();
    writeAudit(ctx.bundle.db, {
      actorUserId: user.id,
      ip: req.ip,
      module: "admissions",
      action: "status",
      entity: "application",
      entityId: id,
      before: { status: row.status },
      after: { status: body.status },
      reason: body.reason,
    });
    return { ok: true };
  });

  app.post("/api/v1/applications/:id/enrol", async (req) => {
    assertCsrf(req);
    const user = requireUser(resolveSession(ctx.bundle, req));
    requirePermission(user, "admissions:manage");
    requirePermission(user, "pupils:create");
    const { id } = req.params as { id: string };
    const body = z.object({ classId: z.string().min(1) }).parse(req.body);
    const row = ctx.bundle.db.select().from(applications).where(eq(applications.id, id)).get();
    if (!row) throw httpError(404, "NOT_FOUND", "Application not found");
    if (row.status !== "accepted") throw httpError(409, "CONFLICT", "Only accepted applications can be enrolled");
    const cls = ctx.bundle.db.select().from(classes).where(eq(classes.id, body.classId)).get();
    if (!cls) throw httpError(400, "VALIDATION", "Unknown class");
    if (cls.levelId !== row.levelId) {
      throw httpError(400, "VALIDATION", "Class must match the applied level");
    }
    const created = ctx.bundle.sqlite.transaction(() => {
      const pupil = createEnrolledPupil(ctx.bundle, {
        givenName: row.givenName,
        familyName: row.familyName,
        sex: row.sex,
        dob: row.dob,
        placeOfBirth: row.placeOfBirth,
        nationality: row.nationality,
        previousSchool: row.previousSchool,
        applicationId: row.id,
        classId: body.classId,
        actorUserId: user.id,
        guardian: {
          givenName: row.guardianGivenName,
          familyName: row.guardianFamilyName,
          phone: row.guardianPhone,
          email: row.guardianEmail ?? "",
          relationship: row.guardianRelationship,
          primaryContact: true,
          feePayer: true,
        },
      });
      ctx.bundle.db
        .update(applications)
        .set({
          status: "enrolled",
          pupilId: pupil.id,
          updatedAt: new Date().toISOString(),
          updatedBy: user.id,
        })
        .where(eq(applications.id, id))
        .run();
      return pupil;
    })();
    writeAudit(ctx.bundle.db, {
      actorUserId: user.id,
      ip: req.ip,
      module: "admissions",
      action: "enrol",
      entity: "application",
      entityId: id,
      after: created,
    });
    return created;
  });
}
