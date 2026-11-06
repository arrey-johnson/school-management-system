import {
  announcementSchema,
  calendarEventSchema,
  documentTemplateSchema,
  templateRenderSchema,
} from "@sms/shared";
import type { FastifyInstance } from "fastify";
import type { AppContext } from "../../app-context.js";
import { writeAudit } from "../../audit/service.js";
import { assertCsrf } from "../../auth/csrf.js";
import { requirePermission, requireUser, resolveSession } from "../../auth/session.js";
import { calendarEvents, documentTemplates } from "../../db/schema.js";
import {
  createAnnouncement,
  createEvent,
  renderTemplate,
  saveTemplate,
  visibleAnnouncements,
} from "./service.js";

export function registerAdminRoutes(app: FastifyInstance, ctx: AppContext): void {
  app.get("/api/v1/calendar", async (req) => {
    const user = requireUser(resolveSession(ctx.bundle, req));
    requirePermission(user, "school:read");
    return { items: ctx.bundle.db.select().from(calendarEvents).all() };
  });

  app.post("/api/v1/calendar", async (req) => {
    assertCsrf(req);
    const user = requireUser(resolveSession(ctx.bundle, req));
    requirePermission(user, "school:update");
    const body = calendarEventSchema.parse(req.body);
    const created = createEvent(ctx.bundle, body, user.id);
    writeAudit(ctx.bundle.db, {
      actorUserId: user.id,
      ip: req.ip,
      module: "admin",
      action: "calendar",
      entity: "calendar_event",
      entityId: created.id,
      after: body,
    });
    return created;
  });

  app.get("/api/v1/announcements", async (req) => {
    const user = requireUser(resolveSession(ctx.bundle, req));
    requirePermission(user, "school:read");
    return { items: visibleAnnouncements(ctx.bundle, user) };
  });

  app.post("/api/v1/announcements", async (req) => {
    assertCsrf(req);
    const user = requireUser(resolveSession(ctx.bundle, req));
    requirePermission(user, "school:update");
    const body = announcementSchema.parse(req.body);
    const created = createAnnouncement(ctx.bundle, body, user.id);
    writeAudit(ctx.bundle.db, {
      actorUserId: user.id,
      ip: req.ip,
      module: "admin",
      action: "announce",
      entity: "announcement",
      entityId: created.id,
      after: { title: body.title, audience: body.audience },
    });
    return created;
  });

  app.get("/api/v1/templates", async (req) => {
    const user = requireUser(resolveSession(ctx.bundle, req));
    requirePermission(user, "school:read");
    return { items: ctx.bundle.db.select().from(documentTemplates).all() };
  });

  app.post("/api/v1/templates", async (req) => {
    assertCsrf(req);
    const user = requireUser(resolveSession(ctx.bundle, req));
    requirePermission(user, "school:update");
    const body = documentTemplateSchema.parse(req.body);
    const created = saveTemplate(ctx.bundle, body, user.id);
    writeAudit(ctx.bundle.db, {
      actorUserId: user.id,
      ip: req.ip,
      module: "admin",
      action: "template",
      entity: "document_template",
      entityId: created.id,
      after: { name: body.name },
    });
    return created;
  });

  app.post("/api/v1/templates/:id/render", async (req) => {
    assertCsrf(req);
    const user = requireUser(resolveSession(ctx.bundle, req));
    requirePermission(user, "school:read");
    const { id } = req.params as { id: string };
    const body = templateRenderSchema.parse(req.body ?? {});
    return renderTemplate(ctx.bundle, id, body.pupilId);
  });
}
