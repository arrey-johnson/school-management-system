import { createId, guardianInputSchema } from "@sms/shared";
import { and, eq } from "drizzle-orm";
import type { z } from "zod";
import type { DatabaseBundle } from "../../db/client.js";
import { nextAdmissionNumber } from "../../db/sequences.js";
import {
  academicYears,
  classes,
  disciplineNotes,
  enrolments,
  guardians,
  levels,
  pupilGuardians,
  pupilStatusHistory,
  pupils,
  sections,
} from "../../db/schema.js";
import { generateInvoiceForPupil } from "../fees/service.js";
import { httpError } from "../../utils/http-error.js";

type GuardianInput = z.infer<typeof guardianInputSchema>;

export function findDuplicatePupils(
  bundle: DatabaseBundle,
  givenName: string,
  familyName: string,
  dob: string,
) {
  return bundle.db
    .select()
    .from(pupils)
    .where(
      and(eq(pupils.givenName, givenName), eq(pupils.familyName, familyName), eq(pupils.dob, dob)),
    )
    .all();
}

export function upsertGuardian(bundle: DatabaseBundle, input: GuardianInput): string {
  const existing = bundle.db.select().from(guardians).where(eq(guardians.phone, input.phone)).get();
  const at = new Date().toISOString();
  if (existing) {
    bundle.db
      .update(guardians)
      .set({
        givenName: input.givenName,
        familyName: input.familyName,
        phone2: input.phone2 || null,
        email: input.email || null,
        occupation: input.occupation || null,
        updatedAt: at,
      })
      .where(eq(guardians.id, existing.id))
      .run();
    return existing.id;
  }
  const id = createId();
  bundle.db
    .insert(guardians)
    .values({
      id,
      givenName: input.givenName,
      familyName: input.familyName,
      phone: input.phone,
      phone2: input.phone2 || null,
      email: input.email || null,
      occupation: input.occupation || null,
      createdAt: at,
      updatedAt: at,
    })
    .run();
  return id;
}

export function linkGuardian(
  bundle: DatabaseBundle,
  pupilId: string,
  guardianId: string,
  input: GuardianInput,
): void {
  const existing = bundle.db
    .select()
    .from(pupilGuardians)
    .where(and(eq(pupilGuardians.pupilId, pupilId), eq(pupilGuardians.guardianId, guardianId)))
    .get();
  if (existing) return;
  bundle.db
    .insert(pupilGuardians)
    .values({
      pupilId,
      guardianId,
      relationship: input.relationship,
      primaryContact: input.primaryContact,
      feePayer: input.feePayer,
    })
    .run();
}

export function recordStatus(
  bundle: DatabaseBundle,
  pupilId: string,
  status: string,
  reason: string | null,
  actorUserId: string,
): void {
  bundle.db
    .insert(pupilStatusHistory)
    .values({
      id: createId(),
      pupilId,
      status,
      reason,
      at: new Date().toISOString(),
      actorUserId,
    })
    .run();
}

export function enrolPupil(
  bundle: DatabaseBundle,
  pupilId: string,
  classId: string,
  placementType: string,
  actorUserId: string,
  promotionBatchId?: string,
): string {
  const cls = bundle.db.select().from(classes).where(eq(classes.id, classId)).get();
  if (!cls) throw httpError(400, "VALIDATION", "Unknown class");
  const already = bundle.db
    .select()
    .from(enrolments)
    .where(and(eq(enrolments.pupilId, pupilId), eq(enrolments.academicYearId, cls.academicYearId)))
    .get();
  if (already) throw httpError(409, "CONFLICT", "Pupil is already enrolled this year");
  const id = createId();
  bundle.db
    .insert(enrolments)
    .values({
      id,
      pupilId,
      academicYearId: cls.academicYearId,
      classId,
      placementType,
      promotionBatchId: promotionBatchId ?? null,
      createdAt: new Date().toISOString(),
      createdBy: actorUserId,
    })
    .run();
  return id;
}

export function createEnrolledPupil(
  bundle: DatabaseBundle,
  input: {
    givenName: string;
    familyName: string;
    sex: string;
    dob: string;
    placeOfBirth?: string | null;
    nationality?: string | null;
    address?: string | null;
    previousSchool?: string | null;
    medicalNotes?: string | null;
    applicationId?: string | null;
    classId: string;
    guardian: GuardianInput;
    actorUserId: string;
  },
): { id: string; admissionNumber: string } {
  const run = () => {
    const admissionNumber = nextAdmissionNumber(bundle);
    const id = createId();
    const at = new Date().toISOString();
    bundle.db
      .insert(pupils)
      .values({
        id,
        admissionNumber,
        givenName: input.givenName,
        familyName: input.familyName,
        sex: input.sex,
        dob: input.dob,
        placeOfBirth: input.placeOfBirth || null,
        nationality: input.nationality || null,
        address: input.address || null,
        previousSchool: input.previousSchool || null,
        medicalNotes: input.medicalNotes || null,
        applicationId: input.applicationId ?? null,
        status: "active",
        createdAt: at,
        updatedAt: at,
        createdBy: input.actorUserId,
        updatedBy: input.actorUserId,
      })
      .run();
    recordStatus(bundle, id, "active", "Enrolled", input.actorUserId);
    const guardianId = upsertGuardian(bundle, input.guardian);
    linkGuardian(bundle, id, guardianId, input.guardian);
    enrolPupil(bundle, id, input.classId, "new", input.actorUserId);
    generateInvoiceForPupil(bundle, id, input.actorUserId);
    return { id, admissionNumber };
  };
  if (bundle.sqlite.inTransaction) return run();
  return bundle.sqlite.transaction(run)();
}

export function classLabel(bundle: DatabaseBundle, classId: string): string {
  const cls = bundle.db.select().from(classes).where(eq(classes.id, classId)).get();
  if (!cls) return "";
  const level = bundle.db.select().from(levels).where(eq(levels.id, cls.levelId)).get();
  return `${level?.name ?? "Class"}${cls.stream ? ` ${cls.stream}` : ""}`;
}

export function findClassByLabel(bundle: DatabaseBundle, label: string) {
  const year = bundle.db.select().from(academicYears).where(eq(academicYears.isActive, true)).get();
  if (!year) return undefined;
  const rows = bundle.db.select().from(classes).where(eq(classes.academicYearId, year.id)).all();
  return rows.find((cls) => classLabel(bundle, cls.id).toLowerCase() === label.trim().toLowerCase());
}

export function pupilTimeline(bundle: DatabaseBundle, pupilId: string) {
  const statusRows = bundle.db
    .select()
    .from(pupilStatusHistory)
    .where(eq(pupilStatusHistory.pupilId, pupilId))
    .all();
  const enrolRows = bundle.db.select().from(enrolments).where(eq(enrolments.pupilId, pupilId)).all();
  const notes = bundle.db
    .select()
    .from(disciplineNotes)
    .where(eq(disciplineNotes.pupilId, pupilId))
    .all();
  const events = [
    ...statusRows.map((row) => ({
      at: row.at,
      type: "status" as const,
      summary: `Status: ${row.status}${row.reason ? ` (${row.reason})` : ""}`,
    })),
    ...enrolRows.map((row) => ({
      at: row.createdAt,
      type: "enrolment" as const,
      summary: `Enrolled in ${classLabel(bundle, row.classId)} (${row.placementType})`,
    })),
    ...notes.map((row) => ({
      at: row.at,
      type: "discipline" as const,
      summary: row.note,
    })),
  ];
  return events.sort((a, b) => (a.at < b.at ? 1 : -1));
}

export function sectionNameForClass(bundle: DatabaseBundle, classId: string): string {
  const cls = bundle.db.select().from(classes).where(eq(classes.id, classId)).get();
  if (!cls) return "";
  const level = bundle.db.select().from(levels).where(eq(levels.id, cls.levelId)).get();
  if (!level) return "";
  const section = bundle.db.select().from(sections).where(eq(sections.id, level.sectionId)).get();
  return section?.name ?? "";
}
