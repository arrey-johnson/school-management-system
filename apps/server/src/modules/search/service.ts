import type { AuthUser } from "../../auth/session.js";
import type { DatabaseBundle } from "../../db/client.js";
import { pupils, receipts, staff } from "../../db/schema.js";

function matches(haystack: string, q: string): boolean {
  return haystack.toLowerCase().includes(q.toLowerCase());
}

export function globalSearch(bundle: DatabaseBundle, user: AuthUser, q: string) {
  const needle = q.trim();
  const canPupils = user.roleSlug === "super_admin" || user.permissions.includes("pupils:read");
  const canStaff = user.roleSlug === "super_admin" || user.permissions.includes("staff:read");
  const canReceipts = user.roleSlug === "super_admin" || user.permissions.includes("payments:read");
  const pupilHits = canPupils
    ? bundle.db
        .select()
        .from(pupils)
        .all()
        .filter(
          (p) =>
            matches(p.givenName, needle) ||
            matches(p.familyName, needle) ||
            matches(p.admissionNumber, needle),
        )
        .slice(0, 8)
        .map((p) => ({
          type: "pupil" as const,
          id: p.id,
          label: `${p.givenName} ${p.familyName}`,
          hint: p.admissionNumber,
          href: `/pupils/${p.id}`,
        }))
    : [];
  const staffHits = canStaff
    ? bundle.db
        .select()
        .from(staff)
        .all()
        .filter((s) => matches(s.givenName, needle) || matches(s.familyName, needle) || matches(s.phone, needle))
        .slice(0, 8)
        .map((s) => ({
          type: "staff" as const,
          id: s.id,
          label: `${s.givenName} ${s.familyName}`,
          hint: s.position,
          href: "/staff",
        }))
    : [];
  const receiptHits = canReceipts
    ? bundle.db
        .select()
        .from(receipts)
        .all()
        .filter((r) => matches(r.number, needle))
        .slice(0, 8)
        .map((r) => ({
          type: "receipt" as const,
          id: r.id,
          label: r.number,
          hint: r.status,
          href: "/fees",
        }))
    : [];
  return { q: needle, items: [...pupilHits, ...staffHits, ...receiptHits] };
}
