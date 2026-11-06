import { createId, type staffCreateSchema } from "@sms/shared";
import { and, eq } from "drizzle-orm";
import type { z } from "zod";
import type { DatabaseBundle } from "../../db/client.js";
import {
  leaves,
  staff,
  staffAssignments,
  staffAttendance,
  staffStatusHistory,
} from "../../db/schema.js";
import { httpError } from "../../utils/http-error.js";

type StaffInput = z.infer<typeof staffCreateSchema>;

function nowIso(): string {
  return new Date().toISOString();
}

export function redactStaff<T extends { nationalId: string | null }>(
  row: T,
  canSeeNationalId: boolean,
): T {
  return { ...row, nationalId: canSeeNationalId ? row.nationalId : null };
}

export function createStaff(bundle: DatabaseBundle, input: StaffInput, actorUserId: string): { id: string } {
  const id = createId();
  const at = nowIso();
  bundle.db
    .insert(staff)
    .values({
      id,
      givenName: input.givenName,
      familyName: input.familyName,
      sex: input.sex,
      dob: input.dob ?? null,
      nationalId: input.nationalId || null,
      phone: input.phone,
      email: input.email || null,
      address: input.address || null,
      department: input.department || null,
      position: input.position,
      employmentType: input.employmentType,
      hireDate: input.hireDate,
      emergencyContact: input.emergencyContact || null,
      userId: input.userId ?? null,
      status: "active",
      createdAt: at,
      updatedAt: at,
      createdBy: actorUserId,
      updatedBy: actorUserId,
    })
    .run();
  bundle.db
    .insert(staffStatusHistory)
    .values({
      id: createId(),
      staffId: id,
      status: "active",
      reason: "Hired",
      at,
      actorUserId,
    })
    .run();
  return { id };
}

export function setStaffStatus(
  bundle: DatabaseBundle,
  staffId: string,
  status: string,
  reason: string,
  actorUserId: string,
): void {
  const row = bundle.db.select().from(staff).where(eq(staff.id, staffId)).get();
  if (!row) throw httpError(404, "NOT_FOUND", "Staff not found");
  const at = nowIso();
  bundle.db
    .update(staff)
    .set({ status, updatedAt: at, updatedBy: actorUserId })
    .where(eq(staff.id, staffId))
    .run();
  bundle.db
    .insert(staffStatusHistory)
    .values({ id: createId(), staffId, status, reason, at, actorUserId })
    .run();
}

export function assignStaff(
  bundle: DatabaseBundle,
  input: {
    staffId: string;
    academicYearId: string;
    role: string;
    classId?: string;
    classSubjectId?: string;
  },
  actorUserId: string,
): { id: string } {
  const person = bundle.db.select().from(staff).where(eq(staff.id, input.staffId)).get();
  if (!person) throw httpError(400, "VALIDATION", "Unknown staff");
  const id = createId();
  bundle.db
    .insert(staffAssignments)
    .values({
      id,
      staffId: input.staffId,
      academicYearId: input.academicYearId,
      role: input.role,
      classId: input.classId ?? null,
      classSubjectId: input.classSubjectId ?? null,
      createdAt: nowIso(),
      createdBy: actorUserId,
    })
    .run();
  return { id };
}

export function requestLeave(
  bundle: DatabaseBundle,
  input: { staffId: string; type: string; startDate: string; endDate: string; reason?: string },
  actorUserId: string,
): { id: string } {
  if (input.endDate < input.startDate) throw httpError(400, "VALIDATION", "Leave end must be on or after start");
  const id = createId();
  bundle.db
    .insert(leaves)
    .values({
      id,
      staffId: input.staffId,
      type: input.type,
      startDate: input.startDate,
      endDate: input.endDate,
      reason: input.reason || null,
      status: "pending",
      createdAt: nowIso(),
      createdBy: actorUserId,
    })
    .run();
  return { id };
}

export function decideLeave(bundle: DatabaseBundle, leaveId: string, status: "approved" | "rejected"): void {
  const row = bundle.db.select().from(leaves).where(eq(leaves.id, leaveId)).get();
  if (!row) throw httpError(404, "NOT_FOUND", "Leave not found");
  bundle.db.update(leaves).set({ status }).where(eq(leaves.id, leaveId)).run();
}

export function markAttendance(
  bundle: DatabaseBundle,
  input: { staffId: string; day: string; mark: string },
  actorUserId: string,
): { id: string } {
  const existing = bundle.db
    .select()
    .from(staffAttendance)
    .where(and(eq(staffAttendance.staffId, input.staffId), eq(staffAttendance.day, input.day)))
    .get();
  if (existing) {
    bundle.db.update(staffAttendance).set({ mark: input.mark }).where(eq(staffAttendance.id, existing.id)).run();
    return { id: existing.id };
  }
  const id = createId();
  bundle.db
    .insert(staffAttendance)
    .values({
      id,
      staffId: input.staffId,
      day: input.day,
      mark: input.mark,
      createdAt: nowIso(),
      createdBy: actorUserId,
    })
    .run();
  return { id };
}
