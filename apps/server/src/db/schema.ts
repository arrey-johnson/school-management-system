import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const schoolProfile = sqliteTable("school_profile", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  motto: text("motto"),
  address: text("address"),
  phone: text("phone"),
  email: text("email"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  createdBy: text("created_by"),
  updatedBy: text("updated_by"),
});

export const academicYears = sqliteTable("academic_years", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  createdBy: text("created_by"),
  updatedBy: text("updated_by"),
});

export const terms = sqliteTable("terms", {
  id: text("id").primaryKey(),
  academicYearId: text("academic_year_id")
    .notNull()
    .references(() => academicYears.id),
  sequence: integer("sequence").notNull(),
  name: text("name").notNull(),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const sections = sqliteTable("sections", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").notNull(),
  archivedAt: text("archived_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const levels = sqliteTable("levels", {
  id: text("id").primaryKey(),
  sectionId: text("section_id")
    .notNull()
    .references(() => sections.id),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const roles = sqliteTable("roles", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  isSystem: integer("is_system", { mode: "boolean" }).notNull().default(true),
});

export const permissions = sqliteTable("permissions", {
  id: text("id").primaryKey(),
  code: text("code").notNull().unique(),
  description: text("description").notNull(),
});

export const rolePermissions = sqliteTable(
  "role_permissions",
  {
    roleId: text("role_id")
      .notNull()
      .references(() => roles.id),
    permissionId: text("permission_id")
      .notNull()
      .references(() => permissions.id),
  },
  (t) => ({
    pk: uniqueIndex("role_permissions_pk").on(t.roleId, t.permissionId),
  }),
);

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  displayName: text("display_name").notNull(),
  roleId: text("role_id")
    .notNull()
    .references(() => roles.id),
  locale: text("locale").notNull().default("en"),
  mustChangePassword: integer("must_change_password", { mode: "boolean" }).notNull().default(true),
  disabledAt: text("disabled_at"),
  failedLoginCount: integer("failed_login_count").notNull().default(0),
  lockedUntil: text("locked_until"),
  lastLoginAt: text("last_login_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  createdBy: text("created_by"),
  updatedBy: text("updated_by"),
});

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  tokenHash: text("token_hash").notNull().unique(),
  createdAt: text("created_at").notNull(),
  expiresAt: text("expires_at").notNull(),
  lastSeenAt: text("last_seen_at").notNull(),
  ip: text("ip"),
  userAgent: text("user_agent"),
  revokedAt: text("revoked_at"),
});

export const loginAttempts = sqliteTable("login_attempts", {
  id: text("id").primaryKey(),
  username: text("username").notNull(),
  success: integer("success", { mode: "boolean" }).notNull(),
  ip: text("ip"),
  createdAt: text("created_at").notNull(),
});

export const auditLog = sqliteTable("audit_log", {
  id: text("id").primaryKey(),
  at: text("at").notNull(),
  actorUserId: text("actor_user_id"),
  ip: text("ip"),
  workstation: text("workstation"),
  module: text("module").notNull(),
  action: text("action").notNull(),
  entity: text("entity").notNull(),
  entityId: text("entity_id"),
  beforeJson: text("before_json"),
  afterJson: text("after_json"),
  reason: text("reason"),
  prevHash: text("prev_hash").notNull(),
  rowHash: text("row_hash").notNull(),
});

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  valueJson: text("value_json").notNull(),
  updatedAt: text("updated_at").notNull(),
  updatedBy: text("updated_by"),
});

export const numberSequences = sqliteTable("number_sequences", {
  name: text("name").primaryKey(),
  prefix: text("prefix").notNull(),
  nextValue: integer("next_value").notNull(),
  padding: integer("padding").notNull(),
  updatedAt: text("updated_at").notNull(),
});
