import {
  academicYearSetupSchema,
  bootstrapSchema,
  createId,
  schoolProfileSchema,
  SCHOOL_KINDS,
  sectionsForSchoolKind,
  type SchoolKind,
} from "@sms/shared";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import type { AppContext } from "../../app-context.js";
import { writeAudit } from "../../audit/service.js";
import { assertCsrf } from "../../auth/csrf.js";
import { hashPassword } from "../../auth/password.js";
import { requirePermission, requireUser, resolveSession } from "../../auth/session.js";
import { academicYears, levels, roles, schoolProfile, sections, settings, terms, users } from "../../db/schema.js";
import { httpError } from "../../utils/http-error.js";

function isSetupComplete(ctx: AppContext): boolean {
  const row = ctx.bundle.db.select().from(settings).where(eq(settings.key, "setup.complete")).get();
  return row?.valueJson === "true";
}

function userCount(ctx: AppContext): number {
  return ctx.bundle.db.select().from(users).all().length;
}

export function registerSetupRoutes(app: FastifyInstance, ctx: AppContext): void {
  app.get("/api/v1/setup/status", async () => {
    const profile = ctx.bundle.db.select().from(schoolProfile).get();
    const year = ctx.bundle.db.select().from(academicYears).get();
    return {
      complete: isSetupComplete(ctx),
      hasUsers: userCount(ctx) > 0,
      hasSchool: Boolean(profile),
      hasAcademicYear: Boolean(year),
    };
  });

  app.post("/api/v1/setup/bootstrap", async (req) => {
    assertCsrf(req);
    if (userCount(ctx) > 0) {
      throw httpError(409, "CONFLICT", "An administrator already exists");
    }
    const body = bootstrapSchema.parse(req.body);
    const role = ctx.bundle.db.select().from(roles).where(eq(roles.slug, "super_admin")).get();
    if (!role) throw httpError(500, "INTERNAL", "Roles not seeded");
    const passwordHash = await hashPassword(body.password, ctx.env.SMS_TEST === "1");
    const id = createId();
    const at = new Date().toISOString();
    ctx.bundle.db
      .insert(users)
      .values({
        id,
        username: body.username,
        passwordHash,
        displayName: body.displayName,
        roleId: role.id,
        locale: "en",
        mustChangePassword: ctx.env.SMS_TEST !== "1",
        createdAt: at,
        updatedAt: at,
      })
      .run();
    writeAudit(ctx.bundle.db, {
      actorUserId: id,
      ip: req.ip,
      module: "setup",
      action: "bootstrap",
      entity: "user",
      entityId: id,
      after: { username: body.username },
    });
    return { ok: true, userId: id };
  });

  app.post("/api/v1/setup/school", async (req) => {
    assertCsrf(req);
    const user = requireUser(resolveSession(ctx.bundle, req));
    requirePermission(user, "system:setup");
    const body = schoolProfileSchema.parse(req.body);
    const at = new Date().toISOString();
    const existing = ctx.bundle.db.select().from(schoolProfile).get();
    if (existing) {
      ctx.bundle.db
        .update(schoolProfile)
        .set({
          name: body.name,
          schoolKind: body.schoolKind,
          motto: body.motto || null,
          address: body.address || null,
          phone: body.phone || null,
          email: body.email || null,
          updatedAt: at,
          updatedBy: user.id,
        })
        .where(eq(schoolProfile.id, existing.id))
        .run();
    } else {
      ctx.bundle.db
        .insert(schoolProfile)
        .values({
          id: createId(),
          name: body.name,
          schoolKind: body.schoolKind,
          motto: body.motto || null,
          address: body.address || null,
          phone: body.phone || null,
          email: body.email || null,
          createdAt: at,
          updatedAt: at,
          createdBy: user.id,
          updatedBy: user.id,
        })
        .run();
    }
    writeAudit(ctx.bundle.db, {
      actorUserId: user.id,
      ip: req.ip,
      module: "setup",
      action: "school_profile",
      entity: "school_profile",
      after: body,
    });
    return { ok: true };
  });

  app.post("/api/v1/setup/academic-year", async (req) => {
    assertCsrf(req);
    const user = requireUser(resolveSession(ctx.bundle, req));
    requirePermission(user, "system:setup");
    const body = academicYearSetupSchema.parse(req.body);
    if (ctx.bundle.db.select().from(academicYears).get()) {
      throw httpError(409, "CONFLICT", "An academic year already exists");
    }
    const profile = ctx.bundle.db.select().from(schoolProfile).get();
    if (!profile) {
      throw httpError(400, "VALIDATION", "Save the school profile first");
    }
    const kind: SchoolKind = (SCHOOL_KINDS as readonly string[]).includes(profile.schoolKind)
      ? (profile.schoolKind as SchoolKind)
      : "combined";
    const at = new Date().toISOString();
    const yearId = createId();
    ctx.bundle.sqlite.transaction(() => {
      ctx.bundle.db
        .insert(academicYears)
        .values({
          id: yearId,
          name: body.name,
          startDate: body.startDate,
          endDate: body.endDate,
          isActive: true,
          createdAt: at,
          updatedAt: at,
          createdBy: user.id,
          updatedBy: user.id,
        })
        .run();
      body.terms.forEach((term, index) => {
        ctx.bundle.db
          .insert(terms)
          .values({
            id: createId(),
            academicYearId: yearId,
            sequence: index + 1,
            name: term.name,
            startDate: term.startDate,
            endDate: term.endDate,
            createdAt: at,
            updatedAt: at,
          })
          .run();
      });
      sectionsForSchoolKind(kind).forEach((section, sIndex) => {
        const sectionId = createId();
        ctx.bundle.db
          .insert(sections)
          .values({
            id: sectionId,
            name: section.name,
            sortOrder: sIndex + 1,
            createdAt: at,
            updatedAt: at,
          })
          .run();
        section.levels.forEach((levelName, lIndex) => {
          ctx.bundle.db
            .insert(levels)
            .values({
              id: createId(),
              sectionId,
              name: levelName,
              sortOrder: lIndex + 1,
              createdAt: at,
              updatedAt: at,
            })
            .run();
        });
      });
    })();
    writeAudit(ctx.bundle.db, {
      actorUserId: user.id,
      ip: req.ip,
      module: "setup",
      action: "academic_year",
      entity: "academic_year",
      entityId: yearId,
      after: { name: body.name },
    });
    return { ok: true };
  });

  app.post("/api/v1/setup/complete", async (req) => {
    assertCsrf(req);
    const user = requireUser(resolveSession(ctx.bundle, req));
    requirePermission(user, "system:setup");
    if (!ctx.bundle.db.select().from(schoolProfile).get()) {
      throw httpError(400, "VALIDATION", "School profile is required");
    }
    if (!ctx.bundle.db.select().from(academicYears).get()) {
      throw httpError(400, "VALIDATION", "Academic year is required");
    }
    const at = new Date().toISOString();
    ctx.bundle.db
      .update(settings)
      .set({ valueJson: "true", updatedAt: at, updatedBy: user.id })
      .where(eq(settings.key, "setup.complete"))
      .run();
    writeAudit(ctx.bundle.db, {
      actorUserId: user.id,
      ip: req.ip,
      module: "setup",
      action: "complete",
      entity: "settings",
      entityId: "setup.complete",
    });
    return { ok: true };
  });
}
