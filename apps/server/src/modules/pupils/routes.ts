import {
  bulkPromoteSchema,
  createId,
  importPupilsSchema,
  paginationQuerySchema,
  pupilCreateSchema,
  pupilStatusSchema,
} from "@sms/shared";
import { and, eq, like, or } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import type { AppContext } from "../../app-context.js";
import { writeAudit } from "../../audit/service.js";
import { assertCsrf } from "../../auth/csrf.js";
import { requirePermission, requireUser, resolveSession } from "../../auth/session.js";
import {
  classes,
  enrolments,
  guardians,
  promotionBatches,
  pupilGuardians,
  pupils,
} from "../../db/schema.js";
import { httpError } from "../../utils/http-error.js";
import {
  classLabel,
  createEnrolledPupil,
  findClassByLabel,
  findDuplicatePupils,
  pupilTimeline,
  recordStatus,
} from "./service.js";

export function registerPupilRoutes(app: FastifyInstance, ctx: AppContext): void {
  app.get("/api/v1/pupils", async (req) => {
    const user = requireUser(resolveSession(ctx.bundle, req));
    requirePermission(user, "pupils:read");
    const query = paginationQuerySchema.extend({}).parse(req.query);
    const q = typeof req.query === "object" && req.query && "q" in req.query ? String(req.query.q ?? "").trim() : "";
    const classId =
      typeof req.query === "object" && req.query && "classId" in req.query
        ? String(req.query.classId ?? "").trim()
        : "";
    let rows = ctx.bundle.db.select().from(pupils).orderBy(pupils.familyName, pupils.givenName).all();
    if (q) {
      const likeQ = `%${q}%`;
      const byName = ctx.bundle.db
        .select()
        .from(pupils)
        .where(
          or(
            like(pupils.givenName, likeQ),
            like(pupils.familyName, likeQ),
            like(pupils.admissionNumber, likeQ),
          ),
        )
        .all();
      const byPhone = ctx.bundle.db
        .select({ pupilId: pupilGuardians.pupilId })
        .from(pupilGuardians)
        .innerJoin(guardians, eq(pupilGuardians.guardianId, guardians.id))
        .where(like(guardians.phone, likeQ))
        .all();
      const ids = new Set([...byName.map((p) => p.id), ...byPhone.map((p) => p.pupilId)]);
      rows = rows.filter((p) => ids.has(p.id));
    }
    if (classId) {
      const enrolled = ctx.bundle.db
        .select()
        .from(enrolments)
        .where(eq(enrolments.classId, classId))
        .all();
      const ids = new Set(enrolled.map((e) => e.pupilId));
      rows = rows.filter((p) => ids.has(p.id));
    }
    const start = (query.page - 1) * query.pageSize;
    const enrolRows = ctx.bundle.db.select().from(enrolments).all();
    const items = rows.slice(start, start + query.pageSize).map((pupil) => {
      const enrolment = enrolRows
        .filter((e) => e.pupilId === pupil.id)
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0];
      const canMedical = user.roleSlug === "super_admin" || user.permissions.includes("pupils:medical");
      return {
        ...pupil,
        medicalNotes: canMedical ? pupil.medicalNotes : null,
        classLabel: enrolment ? classLabel(ctx.bundle, enrolment.classId) : null,
        classId: enrolment?.classId ?? null,
      };
    });
    return { items, total: rows.length, page: query.page, pageSize: query.pageSize };
  });

  app.get("/api/v1/pupils/:id", async (req) => {
    const user = requireUser(resolveSession(ctx.bundle, req));
    requirePermission(user, "pupils:read");
    const { id } = req.params as { id: string };
    const pupil = ctx.bundle.db.select().from(pupils).where(eq(pupils.id, id)).get();
    if (!pupil) throw httpError(404, "NOT_FOUND", "Pupil not found");
    const links = ctx.bundle.db.select().from(pupilGuardians).where(eq(pupilGuardians.pupilId, id)).all();
    const guardianRows = links.map((link) => {
      const g = ctx.bundle.db.select().from(guardians).where(eq(guardians.id, link.guardianId)).get();
      return g ? { ...g, relationship: link.relationship, primaryContact: link.primaryContact, feePayer: link.feePayer } : null;
    }).filter(Boolean);
    const canMedical = user.roleSlug === "super_admin" || user.permissions.includes("pupils:medical");
    return {
      pupil: { ...pupil, medicalNotes: canMedical ? pupil.medicalNotes : null },
      guardians: guardianRows,
      timeline: pupilTimeline(ctx.bundle, id),
    };
  });

  app.post("/api/v1/pupils", async (req) => {
    assertCsrf(req);
    const user = requireUser(resolveSession(ctx.bundle, req));
    requirePermission(user, "pupils:create");
    const body = pupilCreateSchema.parse(req.body);
    const dupes = findDuplicatePupils(ctx.bundle, body.givenName, body.familyName, body.dob);
    if (dupes.length > 0 && !body.confirmDuplicate) {
      throw httpError(409, "DUPLICATE", "A pupil with the same name and date of birth already exists");
    }
    const canMedical = user.roleSlug === "super_admin" || user.permissions.includes("pupils:medical");
    const created = createEnrolledPupil(ctx.bundle, {
      ...body,
      medicalNotes: canMedical ? body.medicalNotes : "",
      actorUserId: user.id,
    });
    writeAudit(ctx.bundle.db, {
      actorUserId: user.id,
      ip: req.ip,
      module: "pupils",
      action: "create",
      entity: "pupil",
      entityId: created.id,
      after: created,
    });
    return created;
  });

  app.post("/api/v1/pupils/:id/status", async (req) => {
    assertCsrf(req);
    const user = requireUser(resolveSession(ctx.bundle, req));
    requirePermission(user, "pupils:update");
    const { id } = req.params as { id: string };
    const body = pupilStatusSchema.parse(req.body);
    const pupil = ctx.bundle.db.select().from(pupils).where(eq(pupils.id, id)).get();
    if (!pupil) throw httpError(404, "NOT_FOUND", "Pupil not found");
    ctx.bundle.db
      .update(pupils)
      .set({ status: body.status, updatedAt: new Date().toISOString(), updatedBy: user.id })
      .where(eq(pupils.id, id))
      .run();
    recordStatus(ctx.bundle, id, body.status, body.reason, user.id);
    writeAudit(ctx.bundle.db, {
      actorUserId: user.id,
      ip: req.ip,
      module: "pupils",
      action: "status",
      entity: "pupil",
      entityId: id,
      before: { status: pupil.status },
      after: { status: body.status },
      reason: body.reason,
    });
    return { ok: true };
  });

  app.post("/api/v1/pupils/import", async (req) => {
    assertCsrf(req);
    const user = requireUser(resolveSession(ctx.bundle, req));
    requirePermission(user, "pupils:create");
    const body = importPupilsSchema.parse(req.body);
    const errors: { row: number; message: string }[] = [];
    const preview: { row: number; admissionWouldCreate: boolean; classLabel: string }[] = [];
    body.rows.forEach((row, index) => {
      const cls = findClassByLabel(ctx.bundle, row.classStream);
      if (!cls) {
        errors.push({ row: index + 1, message: `Unknown class "${row.classStream}"` });
        return;
      }
      preview.push({ row: index + 1, admissionWouldCreate: true, classLabel: classLabel(ctx.bundle, cls.id) });
    });
    if (body.dryRun || errors.length > 0) {
      return { dryRun: true, valid: errors.length === 0, errors, preview };
    }
    const created: { admissionNumber: string }[] = [];
    for (const row of body.rows) {
      const cls = findClassByLabel(ctx.bundle, row.classStream);
      if (!cls) continue;
      created.push(
        createEnrolledPupil(ctx.bundle, {
          givenName: row.givenName,
          familyName: row.familyName,
          sex: row.sex,
          dob: row.dob,
          classId: cls.id,
          actorUserId: user.id,
          guardian: {
            givenName: row.guardianGivenName,
            familyName: row.guardianFamilyName,
            phone: row.guardianPhone,
            relationship: row.relationship,
            primaryContact: true,
            feePayer: true,
          },
        }),
      );
    }
    writeAudit(ctx.bundle.db, {
      actorUserId: user.id,
      ip: req.ip,
      module: "pupils",
      action: "import",
      entity: "pupil",
      after: { count: created.length },
    });
    return { dryRun: false, created: created.length, numbers: created.map((c) => c.admissionNumber) };
  });

  app.post("/api/v1/enrolments/promote", async (req) => {
    assertCsrf(req);
    const user = requireUser(resolveSession(ctx.bundle, req));
    requirePermission(user, "pupils:update");
    const body = bulkPromoteSchema.parse(req.body);
    const source = ctx.bundle.db.select().from(classes).where(eq(classes.id, body.sourceClassId)).get();
    const target = ctx.bundle.db.select().from(classes).where(eq(classes.id, body.targetClassId)).get();
    if (!source || !target) throw httpError(400, "VALIDATION", "Unknown class");
    const batchId = createId();
    const at = new Date().toISOString();
    ctx.bundle.sqlite.transaction(() => {
      ctx.bundle.db
        .insert(promotionBatches)
        .values({
          id: batchId,
          sourceClassId: source.id,
          targetClassId: target.id,
          createdAt: at,
          createdBy: user.id,
        })
        .run();
      for (const pupilId of body.pupilIds) {
        const current = ctx.bundle.db
          .select()
          .from(enrolments)
          .where(and(eq(enrolments.pupilId, pupilId), eq(enrolments.classId, source.id)))
          .get();
        if (!current) throw httpError(400, "VALIDATION", "Pupil is not in the source class");
        ctx.bundle.db.delete(enrolments).where(eq(enrolments.id, current.id)).run();
        ctx.bundle.db
          .insert(enrolments)
          .values({
            id: createId(),
            pupilId,
            academicYearId: target.academicYearId,
            classId: target.id,
            placementType: "promote",
            promotionBatchId: batchId,
            createdAt: at,
            createdBy: user.id,
          })
          .run();
      }
    })();
    writeAudit(ctx.bundle.db, {
      actorUserId: user.id,
      ip: req.ip,
      module: "pupils",
      action: "bulk_promote",
      entity: "promotion_batch",
      entityId: batchId,
      after: body,
    });
    return { batchId };
  });

  app.post("/api/v1/enrolments/promote/:batchId/undo", async (req) => {
    assertCsrf(req);
    const user = requireUser(resolveSession(ctx.bundle, req));
    requirePermission(user, "pupils:update");
    const { batchId } = req.params as { batchId: string };
    const batch = ctx.bundle.db.select().from(promotionBatches).where(eq(promotionBatches.id, batchId)).get();
    if (!batch) throw httpError(404, "NOT_FOUND", "Promotion batch not found");
    if (batch.undoneAt) throw httpError(409, "CONFLICT", "Already undone");
    const ageMs = Date.now() - new Date(batch.createdAt).getTime();
    if (ageMs > 48 * 60 * 60 * 1000) throw httpError(409, "CONFLICT", "Undo window has expired");
    const moved = ctx.bundle.db
      .select()
      .from(enrolments)
      .where(eq(enrolments.promotionBatchId, batchId))
      .all();
    ctx.bundle.sqlite.transaction(() => {
      for (const row of moved) {
        ctx.bundle.db.delete(enrolments).where(eq(enrolments.id, row.id)).run();
        ctx.bundle.db
          .insert(enrolments)
          .values({
            id: createId(),
            pupilId: row.pupilId,
            academicYearId: row.academicYearId,
            classId: batch.sourceClassId,
            placementType: "new",
            createdAt: new Date().toISOString(),
            createdBy: user.id,
          })
          .run();
      }
      ctx.bundle.db
        .update(promotionBatches)
        .set({ undoneAt: new Date().toISOString() })
        .where(eq(promotionBatches.id, batchId))
        .run();
    })();
    return { ok: true };
  });
}
