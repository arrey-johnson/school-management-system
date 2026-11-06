import {
  ALL_PERMISSIONS,
  createId,
  DEFAULT_ADMISSION_PREFIX,
  DEFAULT_RECEIPT_PREFIX,
  DEFAULT_ROLE_PERMISSIONS,
  ROLE_SLUGS,
} from "@sms/shared";
import { eq } from "drizzle-orm";
import type { Db } from "./client.js";
import { numberSequences, permissions, rolePermissions, roles, settings } from "./schema.js";

const ROLE_NAMES: Record<(typeof ROLE_SLUGS)[number], string> = {
  super_admin: "Super Admin",
  proprietor: "Proprietor / Management",
  headteacher: "Headteacher / Academic Lead",
  bursar: "Accountant / Bursar",
  secretary: "Secretary / Admissions",
  teacher: "Teacher",
  hr: "HR / Administrator",
};

function nowIso(): string {
  return new Date().toISOString();
}

export function seedFoundation(db: Db): void {
  const at = nowIso();

  for (const slug of ROLE_SLUGS) {
    const existing = db.select().from(roles).where(eq(roles.slug, slug)).get();
    if (!existing) {
      db.insert(roles)
        .values({ id: createId(), slug, name: ROLE_NAMES[slug], isSystem: true })
        .run();
    }
  }

  for (const code of ALL_PERMISSIONS) {
    const existing = db.select().from(permissions).where(eq(permissions.code, code)).get();
    if (!existing) {
      db.insert(permissions)
        .values({ id: createId(), code, description: code })
        .run();
    }
  }

  const allRoles = db.select().from(roles).all();
  const allPerms = db.select().from(permissions).all();
  const permByCode = new Map(allPerms.map((p) => [p.code, p]));

  for (const role of allRoles) {
    const grants = DEFAULT_ROLE_PERMISSIONS[role.slug] ?? [];
    for (const code of grants) {
      const perm = permByCode.get(code);
      if (!perm) continue;
      const link = db
        .select()
        .from(rolePermissions)
        .where(eq(rolePermissions.roleId, role.id))
        .all()
        .find((row) => row.permissionId === perm.id);
      if (!link) {
        db.insert(rolePermissions).values({ roleId: role.id, permissionId: perm.id }).run();
      }
    }
  }

  const setup = db.select().from(settings).where(eq(settings.key, "setup.complete")).get();
  if (!setup) {
    db.insert(settings)
      .values({ key: "setup.complete", valueJson: "false", updatedAt: at })
      .run();
  }

  const admission = db.select().from(numberSequences).where(eq(numberSequences.name, "admission")).get();
  if (!admission) {
    db.insert(numberSequences)
      .values({
        name: "admission",
        prefix: `${DEFAULT_ADMISSION_PREFIX}-`,
        nextValue: 1,
        padding: 4,
        updatedAt: at,
      })
      .run();
  }

  const receipt = db.select().from(numberSequences).where(eq(numberSequences.name, "receipt")).get();
  if (!receipt) {
    db.insert(numberSequences)
      .values({
        name: "receipt",
        prefix: `${DEFAULT_RECEIPT_PREFIX}-`,
        nextValue: 1,
        padding: 5,
        updatedAt: at,
      })
      .run();
  }
}
