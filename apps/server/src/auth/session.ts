import { createHash, randomBytes } from "node:crypto";
import {
  createId,
  IDLE_TIMEOUT_MS,
  LOCKOUT_FAILURES,
  LOCKOUT_MS,
  SESSION_ABSOLUTE_MS,
  SESSION_COOKIE,
  type Permission,
} from "@sms/shared";
import { and, eq, isNull } from "drizzle-orm";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { DatabaseBundle } from "../db/client.js";
import { rolePermissions, roles, sessions, users } from "../db/schema.js";
import { permissions as permTable } from "../db/schema.js";
import { httpError } from "../utils/http-error.js";

export type AuthUser = {
  id: string;
  username: string;
  displayName: string;
  roleSlug: string;
  roleName: string;
  locale: string;
  mustChangePassword: boolean;
  permissions: Permission[];
};

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function newSessionToken(): string {
  return randomBytes(32).toString("hex");
}

export function setSessionCookie(reply: FastifyReply, token: string, secure: boolean): void {
  void reply.setCookie(SESSION_COOKIE, token, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure,
    maxAge: SESSION_ABSOLUTE_MS / 1000,
  });
}

export function clearSessionCookie(reply: FastifyReply, secure: boolean): void {
  void reply.clearCookie(SESSION_COOKIE, { path: "/", httpOnly: true, sameSite: "lax", secure });
}

export function loadUserWithPermissions(bundle: DatabaseBundle, userId: string): AuthUser | null {
  const row = bundle.db
    .select({
      user: users,
      roleSlug: roles.slug,
      roleName: roles.name,
    })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .where(eq(users.id, userId))
    .get();
  if (!row) return null;
  const grants = bundle.db
    .select({ code: permTable.code })
    .from(rolePermissions)
    .innerJoin(permTable, eq(rolePermissions.permissionId, permTable.id))
    .where(eq(rolePermissions.roleId, row.user.roleId))
    .all()
    .map((r) => r.code as Permission);
  return {
    id: row.user.id,
    username: row.user.username,
    displayName: row.user.displayName,
    roleSlug: row.roleSlug,
    roleName: row.roleName,
    locale: row.user.locale,
    mustChangePassword: row.user.mustChangePassword,
    permissions: row.roleSlug === "super_admin" ? grants : grants,
  };
}

export function createSession(
  bundle: DatabaseBundle,
  userId: string,
  ip: string | undefined,
  userAgent: string | undefined,
): string {
  const token = newSessionToken();
  const now = Date.now();
  bundle.db
    .insert(sessions)
    .values({
      id: createId(),
      userId,
      tokenHash: hashToken(token),
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + SESSION_ABSOLUTE_MS).toISOString(),
      lastSeenAt: new Date(now).toISOString(),
      ip: ip ?? null,
      userAgent: userAgent ?? null,
      revokedAt: null,
    })
    .run();
  return token;
}

export function resolveSession(bundle: DatabaseBundle, request: FastifyRequest): AuthUser | null {
  const token = request.cookies[SESSION_COOKIE];
  if (!token) return null;
  const row = bundle.db
    .select()
    .from(sessions)
    .where(and(eq(sessions.tokenHash, hashToken(token)), isNull(sessions.revokedAt)))
    .get();
  if (!row) return null;
  const now = Date.now();
  if (new Date(row.expiresAt).getTime() <= now) return null;
  if (now - new Date(row.lastSeenAt).getTime() > IDLE_TIMEOUT_MS) return null;
  const user = loadUserWithPermissions(bundle, row.userId);
  if (!user) return null;
  const dbUser = bundle.db.select().from(users).where(eq(users.id, user.id)).get();
  if (!dbUser || dbUser.disabledAt) return null;
  bundle.db
    .update(sessions)
    .set({ lastSeenAt: new Date(now).toISOString() })
    .where(eq(sessions.id, row.id))
    .run();
  return user;
}

export function requireUser(user: AuthUser | null): AuthUser {
  if (!user) throw httpError(401, "UNAUTHENTICATED", "Please sign in");
  return user;
}

export function requirePermission(user: AuthUser, permission: Permission): void {
  if (user.roleSlug === "super_admin") return;
  if (!user.permissions.includes(permission)) {
    throw httpError(403, "FORBIDDEN", "You do not have permission for this action");
  }
}

export function lockUntilIso(): string {
  return new Date(Date.now() + LOCKOUT_MS).toISOString();
}

export { LOCKOUT_FAILURES };
