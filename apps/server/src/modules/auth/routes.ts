import {
  changePasswordSchema,
  createId,
  CSRF_COOKIE,
  loginSchema,
  LOCKOUT_FAILURES,
} from "@sms/shared";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { writeAudit } from "../../audit/service.js";
import { hashPassword, verifyPassword } from "../../auth/password.js";
import { assertCsrf, issueCsrf } from "../../auth/csrf.js";
import {
  clearSessionCookie,
  createSession,
  hashToken,
  loadUserWithPermissions,
  lockUntilIso,
  requireUser,
  resolveSession,
  setSessionCookie,
} from "../../auth/session.js";
import type { AppContext } from "../../app-context.js";
import { loginAttempts, sessions, users } from "../../db/schema.js";
import { httpError } from "../../utils/http-error.js";

export function registerAuthRoutes(app: FastifyInstance, ctx: AppContext): void {
  const secure = false;

  app.get("/api/v1/auth/csrf", async (_req, reply) => {
    const token = issueCsrf(reply, secure);
    return { csrfToken: token };
  });

  app.get("/api/v1/auth/me", async (req) => {
    const user = resolveSession(ctx.bundle, req);
    if (!user) throw httpError(401, "UNAUTHENTICATED", "Please sign in");
    return { user };
  });

  app.post("/api/v1/auth/login", async (req, reply) => {
    assertCsrf(req);
    const body = loginSchema.parse(req.body);
    const ip = req.ip;
    const recordAttempt = (success: boolean) => {
      ctx.bundle.db
        .insert(loginAttempts)
        .values({
          id: createId(),
          username: body.username,
          success,
          ip,
          createdAt: new Date().toISOString(),
        })
        .run();
    };

    const row = ctx.bundle.db.select().from(users).where(eq(users.username, body.username)).get();
    if (!row || row.disabledAt) {
      recordAttempt(false);
      throw httpError(401, "UNAUTHENTICATED", "Invalid username or password");
    }
    if (row.lockedUntil && new Date(row.lockedUntil).getTime() > Date.now()) {
      recordAttempt(false);
      throw httpError(423, "LOCKED", "Account is locked. Try again later.");
    }

    const ok = await verifyPassword(row.passwordHash, body.password);
    if (!ok) {
      const failures = row.failedLoginCount + 1;
      const locked = failures >= LOCKOUT_FAILURES;
      ctx.bundle.db
        .update(users)
        .set({
          failedLoginCount: failures,
          lockedUntil: locked ? lockUntilIso() : row.lockedUntil,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(users.id, row.id))
        .run();
      recordAttempt(false);
      if (locked) throw httpError(423, "LOCKED", "Account is locked. Try again later.");
      throw httpError(401, "UNAUTHENTICATED", "Invalid username or password");
    }

    ctx.bundle.db
      .update(users)
      .set({
        failedLoginCount: 0,
        lockedUntil: null,
        lastLoginAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(users.id, row.id))
      .run();
    recordAttempt(true);

    const token = createSession(ctx.bundle, row.id, ip, req.headers["user-agent"]);
    setSessionCookie(reply, token, secure);
    issueCsrf(reply, secure);
    const user = loadUserWithPermissions(ctx.bundle, row.id);
    writeAudit(ctx.bundle.db, {
      actorUserId: row.id,
      ip,
      module: "auth",
      action: "login",
      entity: "user",
      entityId: row.id,
    });
    return { user, mustChangePassword: row.mustChangePassword };
  });

  app.post("/api/v1/auth/logout", async (req, reply) => {
    const token = req.cookies["sms.sid"];
    if (token) {
      ctx.bundle.db
        .update(sessions)
        .set({ revokedAt: new Date().toISOString() })
        .where(eq(sessions.tokenHash, hashToken(token)))
        .run();
    }
    clearSessionCookie(reply, secure);
    void reply.clearCookie(CSRF_COOKIE, { path: "/" });
    return { ok: true };
  });

  app.post("/api/v1/auth/change-password", async (req) => {
    assertCsrf(req);
    const user = requireUser(resolveSession(ctx.bundle, req));
    const body = changePasswordSchema.parse(req.body);
    const row = ctx.bundle.db.select().from(users).where(eq(users.id, user.id)).get();
    if (!row) throw httpError(401, "UNAUTHENTICATED", "Please sign in");
    const ok = await verifyPassword(row.passwordHash, body.currentPassword);
    if (!ok) throw httpError(401, "UNAUTHENTICATED", "Current password is incorrect");
    const passwordHash = await hashPassword(body.newPassword, ctx.env.SMS_TEST === "1");
    ctx.bundle.db
      .update(users)
      .set({
        passwordHash,
        mustChangePassword: false,
        updatedAt: new Date().toISOString(),
        updatedBy: user.id,
      })
      .where(eq(users.id, user.id))
      .run();
    writeAudit(ctx.bundle.db, {
      actorUserId: user.id,
      ip: req.ip,
      module: "auth",
      action: "change_password",
      entity: "user",
      entityId: user.id,
    });
    return { ok: true };
  });
}
