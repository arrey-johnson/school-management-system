import { createId } from "@sms/shared";
import { and, eq } from "drizzle-orm";
import type { AuthUser } from "../../auth/session.js";
import type { DatabaseBundle } from "../../db/client.js";
import { classSubjects, enrolments, pupilAttendance, staff, staffAssignments } from "../../db/schema.js";
import { httpError } from "../../utils/http-error.js";

function nowIso(): string {
  return new Date().toISOString();
}

export function teacherClassIds(bundle: DatabaseBundle, user: AuthUser): string[] | null {
  if (user.roleSlug !== "teacher") return null;
  const person = bundle.db.select().from(staff).all().find((row) => row.userId === user.id);
  if (!person) return [];
  const assignments = bundle.db
    .select()
    .from(staffAssignments)
    .where(eq(staffAssignments.staffId, person.id))
    .all();
  const ids = new Set<string>();
  for (const row of assignments) {
    if (row.classId) ids.add(row.classId);
    if (row.classSubjectId) {
      const offering = bundle.db.select().from(classSubjects).where(eq(classSubjects.id, row.classSubjectId)).get();
      if (offering) ids.add(offering.classId);
    }
  }
  return [...ids];
}

export function assertCanAttend(bundle: DatabaseBundle, user: AuthUser, classId: string): void {
  const allowed = teacherClassIds(bundle, user);
  if (allowed === null) return;
  if (!allowed.includes(classId)) {
    throw httpError(403, "FORBIDDEN", "You are not assigned to this class");
  }
}

export function registerForDay(bundle: DatabaseBundle, classId: string, day: string, user: AuthUser) {
  assertCanAttend(bundle, user, classId);
  const roster = bundle.db.select().from(enrolments).where(eq(enrolments.classId, classId)).all();
  const rows = bundle.db
    .select()
    .from(pupilAttendance)
    .where(and(eq(pupilAttendance.classId, classId), eq(pupilAttendance.day, day)))
    .all();
  return {
    classId,
    day,
    items: roster.map((enrolment) => {
      const mark = rows.find((row) => row.pupilId === enrolment.pupilId);
      return {
        pupilId: enrolment.pupilId,
        mark: mark?.mark ?? null,
        reason: mark?.reason ?? null,
        submitted: mark?.submitted ?? false,
      };
    }),
  };
}

export function submitAttendance(
  bundle: DatabaseBundle,
  input: {
    classId: string;
    day: string;
    entries: { pupilId: string; mark: string; reason?: string }[];
  },
  user: AuthUser,
): void {
  assertCanAttend(bundle, user, input.classId);
  const at = nowIso();
  for (const entry of input.entries) {
    const existing = bundle.db
      .select()
      .from(pupilAttendance)
      .where(
        and(
          eq(pupilAttendance.classId, input.classId),
          eq(pupilAttendance.pupilId, entry.pupilId),
          eq(pupilAttendance.day, input.day),
        ),
      )
      .get();
    if (existing) {
      bundle.db
        .update(pupilAttendance)
        .set({
          mark: entry.mark,
          reason: entry.reason || null,
          submitted: true,
        })
        .where(eq(pupilAttendance.id, existing.id))
        .run();
    } else {
      bundle.db
        .insert(pupilAttendance)
        .values({
          id: createId(),
          classId: input.classId,
          pupilId: entry.pupilId,
          day: input.day,
          mark: entry.mark,
          reason: entry.reason || null,
          submitted: true,
          createdAt: at,
          createdBy: user.id,
        })
        .run();
    }
  }
}
