import { createId, createUserSchema, paginationQuerySchema } from "@sms/shared";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import type { AppContext } from "../../app-context.js";
import { writeAudit } from "../../audit/service.js";
import { assertCsrf } from "../../auth/csrf.js";
import { hashPassword } from "../../auth/password.js";
import { requirePermission, requireUser, resolveSession } from "../../auth/session.js";
import { roles, users } from "../../db/schema.js";
import { httpError } from "../../utils/http-error.js";

export function registerUserRoutes(app: FastifyInstance, ctx: AppContext): void {
  app.get("/api/v1/users", async (req) => {
    const user = requireUser(resolveSession(ctx.bundle, req));
    requirePermission(user, "system:users");
    const query = paginationQuerySchema.parse(req.query);
    const rows = ctx.bundle.db
      .select({
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        locale: users.locale,
        mustChangePassword: users.mustChangePassword,
        disabledAt: users.disabledAt,
        roleSlug: roles.slug,
        roleName: roles.name,
      })
      .from(users)
      .innerJoin(roles, eq(users.roleId, roles.id))
      .all();
    const start = (query.page - 1) * query.pageSize;
    return {
      items: rows.slice(start, start + query.pageSize),
      page: query.page,
      pageSize: query.pageSize,
      total: rows.length,
    };
  });

  app.post("/api/v1/users", async (req) => {
    assertCsrf(req);
    const actor = requireUser(resolveSession(ctx.bundle, req));
    requirePermission(actor, "system:users");
    const body = createUserSchema.parse(req.body);
    const role = ctx.bundle.db.select().from(roles).where(eq(roles.slug, body.roleSlug)).get();
    if (!role) throw httpError(400, "VALIDATION", "Unknown role");
    const exists = ctx.bundle.db.select().from(users).where(eq(users.username, body.username)).get();
    if (exists) throw httpError(409, "CONFLICT", "Username already exists");
    const id = createId();
    const at = new Date().toISOString();
    ctx.bundle.db
      .insert(users)
      .values({
        id,
        username: body.username,
        passwordHash: await hashPassword(body.password, ctx.env.SMS_TEST === "1"),
        displayName: body.displayName,
        roleId: role.id,
        mustChangePassword: true,
        createdAt: at,
        updatedAt: at,
        createdBy: actor.id,
        updatedBy: actor.id,
      })
      .run();
    writeAudit(ctx.bundle.db, {
      actorUserId: actor.id,
      ip: req.ip,
      module: "users",
      action: "create",
      entity: "user",
      entityId: id,
      after: { username: body.username, roleSlug: body.roleSlug },
    });
    return { id };
  });

  app.post("/api/v1/users/:id/disable", async (req) => {
    assertCsrf(req);
    const actor = requireUser(resolveSession(ctx.bundle, req));
    requirePermission(actor, "system:users");
    const { id } = req.params as { id: string };
    if (id === actor.id) throw httpError(400, "VALIDATION", "You cannot disable your own account");
    const target = ctx.bundle.db.select().from(users).where(eq(users.id, id)).get();
    if (!target) throw httpError(404, "NOT_FOUND", "User not found");
    ctx.bundle.db
      .update(users)
      .set({ disabledAt: new Date().toISOString(), updatedAt: new Date().toISOString(), updatedBy: actor.id })
      .where(eq(users.id, id))
      .run();
    writeAudit(ctx.bundle.db, {
      actorUserId: actor.id,
      ip: req.ip,
      module: "users",
      action: "disable",
      entity: "user",
      entityId: id,
      before: { disabledAt: null },
      after: { disabledAt: "set" },
    });
    return { ok: true };
  });
}
