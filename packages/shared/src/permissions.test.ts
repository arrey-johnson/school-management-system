import { describe, expect, it } from "vitest";
import { DEFAULT_ROLE_PERMISSIONS, roleHasPermission } from "./permissions.js";

describe("permissions", () => {
  it("gives super admin every check", () => {
    expect(roleHasPermission("super_admin", "payroll:view", [])).toBe(true);
  });

  it("hides salary from headteacher defaults", () => {
    const grants = DEFAULT_ROLE_PERMISSIONS.headteacher ?? [];
    expect(grants.includes("payroll:view")).toBe(false);
    expect(roleHasPermission("headteacher", "payroll:view", grants)).toBe(false);
  });

  it("allows bursar to create payments but not approve by default", () => {
    const grants = DEFAULT_ROLE_PERMISSIONS.bursar ?? [];
    expect(roleHasPermission("bursar", "payments:create", grants)).toBe(true);
    expect(roleHasPermission("bursar", "payments:approve", grants)).toBe(false);
  });

  it("keeps demo load and reset on Super Admin only", () => {
    const grants = DEFAULT_ROLE_PERMISSIONS.bursar ?? [];
    expect(roleHasPermission("bursar", "system:demo", grants)).toBe(false);
    expect(roleHasPermission("super_admin", "system:demo", [])).toBe(true);
  });
});
