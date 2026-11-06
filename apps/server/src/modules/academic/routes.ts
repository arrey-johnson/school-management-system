import {
  classCreateSchema,
  classSubjectSchema,
  createId,
  subjectCreateSchema,
} from "@sms/shared";
import { and, eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import type { AppContext } from "../../app-context.js";
import { writeAudit } from "../../audit/service.js";
import { assertCsrf } from "../../auth/csrf.js";
import { requirePermission, requireUser, resolveSession } from "../../auth/session.js";
import {
  academicYears,
  classSubjects,
  classes,
  gradingScaleBands,
  gradingScales,
  levels,
  sections,
  subjects,
  terms,
} from "../../db/schema.js";
import { httpError } from "../../utils/http-error.js";

function nowIso(): string {
  return new Date().toISOString();
}

export function registerAcademicRoutes(app: FastifyInstance, ctx: AppContext): void {
  app.get("/api/v1/academic/tree", async (req) => {
    const user = requireUser(resolveSession(ctx.bundle, req));
    requirePermission(user, "academic:read");
    const years = ctx.bundle.db.select().from(academicYears).all();
    const termRows = ctx.bundle.db.select().from(terms).all();
    const sectionRows = ctx.bundle.db.select().from(sections).all();
    const levelRows = ctx.bundle.db.select().from(levels).all();
    const classRows = ctx.bundle.db.select().from(classes).all();
    const subjectRows = ctx.bundle.db.select().from(subjects).all();
    return {
      years: years.map((year) => ({
        ...year,
        terms: termRows.filter((t) => t.academicYearId === year.id),
      })),
      sections: sectionRows.map((section) => ({
        ...section,
        levels: levelRows.filter((l) => l.sectionId === section.id),
      })),
      classes: classRows.map((cls) => {
        const level = levelRows.find((l) => l.id === cls.levelId);
        const section = sectionRows.find((s) => s.id === level?.sectionId);
        return {
          ...cls,
          levelName: level?.name ?? "",
          sectionName: section?.name ?? "",
          label: `${level?.name ?? "Class"}${cls.stream ? ` ${cls.stream}` : ""}`,
        };
      }),
      subjects: subjectRows,
    };
  });

  app.post("/api/v1/academic/classes", async (req) => {
    assertCsrf(req);
    const user = requireUser(resolveSession(ctx.bundle, req));
    requirePermission(user, "academic:manage");
    const body = classCreateSchema.parse(req.body);
    const level = ctx.bundle.db.select().from(levels).where(eq(levels.id, body.levelId)).get();
    if (!level) throw httpError(400, "VALIDATION", "Unknown level");
    const stream = body.stream?.trim() ? body.stream.trim() : null;
    const duplicate = ctx.bundle.db
      .select()
      .from(classes)
      .where(and(eq(classes.academicYearId, body.academicYearId), eq(classes.levelId, body.levelId)))
      .all()
      .find((row) => (row.stream ?? "") === (stream ?? ""));
    if (duplicate) throw httpError(409, "CONFLICT", "That class already exists");
    const id = createId();
    const at = nowIso();
    ctx.bundle.db
      .insert(classes)
      .values({
        id,
        academicYearId: body.academicYearId,
        levelId: body.levelId,
        stream,
        capacity: body.capacity,
        createdAt: at,
        updatedAt: at,
        createdBy: user.id,
        updatedBy: user.id,
      })
      .run();
    writeAudit(ctx.bundle.db, {
      actorUserId: user.id,
      ip: req.ip,
      module: "academic",
      action: "create_class",
      entity: "class",
      entityId: id,
      after: body,
    });
    return { id };
  });

  app.post("/api/v1/academic/subjects", async (req) => {
    assertCsrf(req);
    const user = requireUser(resolveSession(ctx.bundle, req));
    requirePermission(user, "academic:manage");
    const body = subjectCreateSchema.parse(req.body);
    const exists = ctx.bundle.db.select().from(subjects).where(eq(subjects.code, body.code)).get();
    if (exists) throw httpError(409, "CONFLICT", "Subject code already exists");
    const id = createId();
    const at = nowIso();
    ctx.bundle.db
      .insert(subjects)
      .values({ id, code: body.code, name: body.name, createdAt: at, updatedAt: at })
      .run();
    writeAudit(ctx.bundle.db, {
      actorUserId: user.id,
      ip: req.ip,
      module: "academic",
      action: "create_subject",
      entity: "subject",
      entityId: id,
      after: body,
    });
    return { id };
  });

  app.post("/api/v1/academic/class-subjects", async (req) => {
    assertCsrf(req);
    const user = requireUser(resolveSession(ctx.bundle, req));
    requirePermission(user, "academic:manage");
    const body = classSubjectSchema.parse(req.body);
    const id = createId();
    ctx.bundle.db
      .insert(classSubjects)
      .values({
        id,
        classId: body.classId,
        subjectId: body.subjectId,
        coefficient: body.coefficient,
        createdAt: nowIso(),
      })
      .run();
    return { id };
  });

  app.get("/api/v1/academic/grading", async (req) => {
    const user = requireUser(resolveSession(ctx.bundle, req));
    requirePermission(user, "academic:read");
    ensureGradingDefaults(ctx);
    const scales = ctx.bundle.db.select().from(gradingScales).all();
    const bands = ctx.bundle.db.select().from(gradingScaleBands).all();
    return {
      scales: scales.map((scale) => ({
        ...scale,
        bands: bands.filter((b) => b.scaleId === scale.id),
      })),
    };
  });
}

function ensureGradingDefaults(ctx: AppContext): void {
  const existing = ctx.bundle.db.select().from(gradingScales).all();
  if (existing.length > 0) return;
  const sectionRows = ctx.bundle.db.select().from(sections).all();
  const at = nowIso();
  for (const section of sectionRows) {
    const secondary = /secondary/i.test(section.name);
    const outOf = secondary ? 20 : 100;
    const pass = secondary ? 10 : 50;
    const scaleId = createId();
    ctx.bundle.db
      .insert(gradingScales)
      .values({
        id: scaleId,
        sectionId: section.id,
        scoreOutOf: outOf,
        passMark: pass,
        createdAt: at,
        updatedAt: at,
      })
      .run();
    const bands = secondary
      ? [
          { min: 16, max: 20, letter: "A", remark: "Excellent" },
          { min: 14, max: 15, letter: "B", remark: "Very good" },
          { min: 12, max: 13, letter: "C", remark: "Good" },
          { min: 10, max: 11, letter: "D", remark: "Average" },
          { min: 0, max: 9, letter: "E", remark: "Fail" },
        ]
      : [
          { min: 80, max: 100, letter: "A", remark: "Excellent" },
          { min: 70, max: 79, letter: "B", remark: "Very good" },
          { min: 60, max: 69, letter: "C", remark: "Good" },
          { min: 50, max: 59, letter: "D", remark: "Average" },
          { min: 0, max: 49, letter: "E", remark: "Fail" },
        ];
    for (const band of bands) {
      ctx.bundle.db
        .insert(gradingScaleBands)
        .values({
          id: createId(),
          scaleId,
          minScore: band.min,
          maxScore: band.max,
          letter: band.letter,
          remark: band.remark,
        })
        .run();
    }
  }
}
