import {
  assessmentCreateSchema,
  assessmentTypeCreateSchema,
  marksSaveSchema,
} from "@sms/shared";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { AppContext } from "../../app-context.js";
import { writeAudit } from "../../audit/service.js";
import { assertCsrf } from "../../auth/csrf.js";
import { requirePermission, requireUser, resolveSession } from "../../auth/session.js";
import {
  assessmentTypes,
  assessments,
  classSubjects,
  enrolments,
  marks,
  termResults,
} from "../../db/schema.js";
import { httpError } from "../../utils/http-error.js";
import {
  assertCanMark,
  computeClassTerm,
  createAssessment,
  createAssessmentType,
  issueReportCard,
  saveMarks,
  submitAssessment,
  teacherClassSubjectIds,
  unlockAssessment,
} from "./service.js";

export function registerAcademicsRoutes(app: FastifyInstance, ctx: AppContext): void {
  app.get("/api/v1/academics/types", async (req) => {
    const user = requireUser(resolveSession(ctx.bundle, req));
    requirePermission(user, "academics:read");
    const query = z.object({ termId: z.string().optional() }).parse(req.query);
    const items = ctx.bundle.db.select().from(assessmentTypes).all();
    return { items: query.termId ? items.filter((row) => row.termId === query.termId) : items };
  });

  app.post("/api/v1/academics/types", async (req) => {
    assertCsrf(req);
    const user = requireUser(resolveSession(ctx.bundle, req));
    requirePermission(user, "academics:unlock");
    const body = assessmentTypeCreateSchema.parse(req.body);
    const created = createAssessmentType(ctx.bundle, body, user.id);
    writeAudit(ctx.bundle.db, {
      actorUserId: user.id,
      ip: req.ip,
      module: "academics",
      action: "create_type",
      entity: "assessment_type",
      entityId: created.id,
      after: body,
    });
    return created;
  });

  app.get("/api/v1/academics/offerings", async (req) => {
    const user = requireUser(resolveSession(ctx.bundle, req));
    requirePermission(user, "academics:read");
    const query = z.object({ classId: z.string().optional() }).parse(req.query);
    const items = ctx.bundle.db.select().from(classSubjects).all();
    const scoped = teacherClassSubjectIds(ctx.bundle, user);
    const filtered = items.filter((row) => {
      if (query.classId && row.classId !== query.classId) return false;
      if (scoped === null) return true;
      return scoped.includes(row.id);
    });
    return { items: filtered };
  });

  app.get("/api/v1/academics/assessments", async (req) => {
    const user = requireUser(resolveSession(ctx.bundle, req));
    requirePermission(user, "academics:read");
    const query = z.object({ classSubjectId: z.string().optional() }).parse(req.query);
    const scoped = teacherClassSubjectIds(ctx.bundle, user);
    const items = ctx.bundle.db
      .select()
      .from(assessments)
      .all()
      .filter((row) => {
        if (query.classSubjectId && row.classSubjectId !== query.classSubjectId) return false;
        if (scoped === null) return true;
        return scoped.includes(row.classSubjectId);
      });
    return { items };
  });

  app.post("/api/v1/academics/assessments", async (req) => {
    assertCsrf(req);
    const user = requireUser(resolveSession(ctx.bundle, req));
    requirePermission(user, "academics:marks");
    const body = assessmentCreateSchema.parse(req.body);
    const created = createAssessment(ctx.bundle, body, user);
    writeAudit(ctx.bundle.db, {
      actorUserId: user.id,
      ip: req.ip,
      module: "academics",
      action: "create_assessment",
      entity: "assessment",
      entityId: created.id,
      after: body,
    });
    return created;
  });

  app.get("/api/v1/academics/assessments/:id", async (req) => {
    const user = requireUser(resolveSession(ctx.bundle, req));
    requirePermission(user, "academics:read");
    const { id } = req.params as { id: string };
    const assessment = ctx.bundle.db.select().from(assessments).where(eq(assessments.id, id)).get();
    if (!assessment) throw httpError(404, "NOT_FOUND", "Assessment not found");
    assertCanMark(ctx.bundle, user, assessment.classSubjectId);
    const offering = ctx.bundle.db
      .select()
      .from(classSubjects)
      .where(eq(classSubjects.id, assessment.classSubjectId))
      .get();
    const roster = offering
      ? ctx.bundle.db.select().from(enrolments).where(eq(enrolments.classId, offering.classId)).all()
      : [];
    const markRows = ctx.bundle.db.select().from(marks).where(eq(marks.assessmentId, id)).all();
    const type = ctx.bundle.db.select().from(assessmentTypes).where(eq(assessmentTypes.id, assessment.typeId)).get();
    return {
      assessment,
      type,
      roster: roster.map((row) => {
        const mark = markRows.find((m) => m.pupilId === row.pupilId);
        return { pupilId: row.pupilId, score: mark?.score ?? null, status: mark?.status ?? "present" };
      }),
    };
  });

  app.post("/api/v1/academics/marks", async (req) => {
    assertCsrf(req);
    const user = requireUser(resolveSession(ctx.bundle, req));
    requirePermission(user, "academics:marks");
    const body = marksSaveSchema.parse(req.body);
    saveMarks(ctx.bundle, body.assessmentId, body.marks, user);
    writeAudit(ctx.bundle.db, {
      actorUserId: user.id,
      ip: req.ip,
      module: "academics",
      action: "save_marks",
      entity: "assessment",
      entityId: body.assessmentId,
      after: { count: body.marks.length },
    });
    return { ok: true };
  });

  app.post("/api/v1/academics/assessments/:id/submit", async (req) => {
    assertCsrf(req);
    const user = requireUser(resolveSession(ctx.bundle, req));
    requirePermission(user, "academics:marks");
    const { id } = req.params as { id: string };
    submitAssessment(ctx.bundle, id, user);
    writeAudit(ctx.bundle.db, {
      actorUserId: user.id,
      ip: req.ip,
      module: "academics",
      action: "submit",
      entity: "assessment",
      entityId: id,
    });
    return { ok: true };
  });

  app.post("/api/v1/academics/assessments/:id/unlock", async (req) => {
    assertCsrf(req);
    const user = requireUser(resolveSession(ctx.bundle, req));
    requirePermission(user, "academics:unlock");
    const { id } = req.params as { id: string };
    unlockAssessment(ctx.bundle, id);
    writeAudit(ctx.bundle.db, {
      actorUserId: user.id,
      ip: req.ip,
      module: "academics",
      action: "unlock",
      entity: "assessment",
      entityId: id,
    });
    return { ok: true };
  });

  app.post("/api/v1/academics/compute", async (req) => {
    assertCsrf(req);
    const user = requireUser(resolveSession(ctx.bundle, req));
    requirePermission(user, "academics:unlock");
    const body = z.object({ classId: z.string().min(1), termId: z.string().min(1) }).parse(req.body);
    const snapshot = computeClassTerm(ctx.bundle, body.classId, body.termId, user.id);
    writeAudit(ctx.bundle.db, {
      actorUserId: user.id,
      ip: req.ip,
      module: "academics",
      action: "compute",
      entity: "term_result",
      entityId: body.classId,
      after: { termId: body.termId, classSize: snapshot.classSize },
    });
    return snapshot;
  });

  app.get("/api/v1/academics/results", async (req) => {
    const user = requireUser(resolveSession(ctx.bundle, req));
    requirePermission(user, "academics:read");
    const query = z.object({ classId: z.string().min(1), termId: z.string().min(1) }).parse(req.query);
    const row = ctx.bundle.db
      .select()
      .from(termResults)
      .all()
      .find((item) => item.classId === query.classId && item.termId === query.termId);
    return { snapshot: row ? (JSON.parse(row.snapshotJson) as unknown) : null };
  });

  app.get("/api/v1/report-cards/:pupilId/:termId/pdf", async (req, reply) => {
    const user = requireUser(resolveSession(ctx.bundle, req));
    requirePermission(user, "academics:read");
    const { pupilId, termId } = req.params as { pupilId: string; termId: string };
    const card = issueReportCard(ctx.bundle, pupilId, termId, user.id);
    if (card.withheld && user.roleSlug === "teacher") {
      return reply.status(409).send({ error: { code: "WITHHELD", message: "Report card withheld for outstanding fees" } });
    }
    return reply.header("content-type", "application/pdf").send(card.pdf);
  });
}
