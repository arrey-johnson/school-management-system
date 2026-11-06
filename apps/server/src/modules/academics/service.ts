import {
  competitionRanks,
  createId,
  lookupGrade,
  subjectAverage,
  toScale,
  weightedTermAverage,
  type AssessmentMark,
} from "@sms/shared";
import { and, eq } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import type { AuthUser } from "../../auth/session.js";
import type { DatabaseBundle } from "../../db/client.js";
import {
  assessmentTypes,
  assessments,
  classSubjects,
  classes,
  enrolments,
  gradingScaleBands,
  gradingScales,
  levels,
  marks,
  pupils,
  reportCards,
  sections,
  settings,
  staff,
  staffAssignments,
  subjects,
  termResults,
  terms,
} from "../../db/schema.js";
import { accountForInvoice, invoiceForPupilYear } from "../fees/ledger.js";
import { buildTextPdf } from "../../pdf/simple-pdf.js";
import { httpError } from "../../utils/http-error.js";

function nowIso(): string {
  return new Date().toISOString();
}

export function teacherClassSubjectIds(bundle: DatabaseBundle, user: AuthUser): string[] | null {
  if (user.roleSlug !== "teacher") return null;
  const person = bundle.db.select().from(staff).all().find((row) => row.userId === user.id);
  if (!person) return [];
  return bundle.db
    .select()
    .from(staffAssignments)
    .where(eq(staffAssignments.staffId, person.id))
    .all()
    .map((row) => row.classSubjectId)
    .filter((id): id is string => Boolean(id));
}

export function assertCanMark(bundle: DatabaseBundle, user: AuthUser, classSubjectId: string): void {
  const allowed = teacherClassSubjectIds(bundle, user);
  if (allowed === null) return;
  if (!allowed.includes(classSubjectId)) {
    throw httpError(403, "FORBIDDEN", "You are not assigned to this class subject");
  }
}

export function createAssessmentType(
  bundle: DatabaseBundle,
  input: { name: string; termId: string; weight: number; maxScore: number },
  actorUserId: string,
): { id: string } {
  const id = createId();
  bundle.db
    .insert(assessmentTypes)
    .values({
      id,
      name: input.name,
      termId: input.termId,
      weight: input.weight,
      maxScore: input.maxScore,
      createdAt: nowIso(),
      createdBy: actorUserId,
    })
    .run();
  return { id };
}

export function createAssessment(
  bundle: DatabaseBundle,
  input: { typeId: string; classSubjectId: string },
  user: AuthUser,
): { id: string } {
  assertCanMark(bundle, user, input.classSubjectId);
  const existing = bundle.db
    .select()
    .from(assessments)
    .all()
    .find((row) => row.typeId === input.typeId && row.classSubjectId === input.classSubjectId);
  if (existing) return { id: existing.id };
  const id = createId();
  bundle.db
    .insert(assessments)
    .values({
      id,
      typeId: input.typeId,
      classSubjectId: input.classSubjectId,
      status: "draft",
      createdAt: nowIso(),
    })
    .run();
  return { id };
}

export function saveMarks(
  bundle: DatabaseBundle,
  assessmentId: string,
  entries: { pupilId: string; score: number | null; status: string }[],
  user: AuthUser,
): void {
  const assessment = bundle.db.select().from(assessments).where(eq(assessments.id, assessmentId)).get();
  if (!assessment) throw httpError(404, "NOT_FOUND", "Assessment not found");
  if (assessment.status === "locked") throw httpError(409, "CONFLICT", "Assessment is locked");
  assertCanMark(bundle, user, assessment.classSubjectId);
  const type = bundle.db.select().from(assessmentTypes).where(eq(assessmentTypes.id, assessment.typeId)).get();
  const max = type?.maxScore ?? 20;
  const at = nowIso();
  for (const entry of entries) {
    if (entry.score !== null && (entry.score < 0 || entry.score > max)) {
      throw httpError(400, "VALIDATION", `Score must be between 0 and ${max}`);
    }
    const existing = bundle.db
      .select()
      .from(marks)
      .where(and(eq(marks.assessmentId, assessmentId), eq(marks.pupilId, entry.pupilId)))
      .get();
    if (existing) {
      bundle.db
        .update(marks)
        .set({ score: entry.score, status: entry.status, updatedAt: at, updatedBy: user.id })
        .where(eq(marks.id, existing.id))
        .run();
    } else {
      bundle.db
        .insert(marks)
        .values({
          id: createId(),
          assessmentId,
          pupilId: entry.pupilId,
          score: entry.score,
          status: entry.status,
          updatedAt: at,
          updatedBy: user.id,
        })
        .run();
    }
  }
}

export function submitAssessment(bundle: DatabaseBundle, assessmentId: string, user: AuthUser): void {
  const assessment = bundle.db.select().from(assessments).where(eq(assessments.id, assessmentId)).get();
  if (!assessment) throw httpError(404, "NOT_FOUND", "Assessment not found");
  assertCanMark(bundle, user, assessment.classSubjectId);
  bundle.db
    .update(assessments)
    .set({ status: "locked", submittedAt: nowIso(), submittedBy: user.id })
    .where(eq(assessments.id, assessmentId))
    .run();
}

export function unlockAssessment(bundle: DatabaseBundle, assessmentId: string): void {
  const assessment = bundle.db.select().from(assessments).where(eq(assessments.id, assessmentId)).get();
  if (!assessment) throw httpError(404, "NOT_FOUND", "Assessment not found");
  bundle.db.update(assessments).set({ status: "draft", submittedAt: null }).where(eq(assessments.id, assessmentId)).run();
}

function treatMissingAsZero(bundle: DatabaseBundle): boolean {
  const row = bundle.db.select().from(settings).where(eq(settings.key, "academics.treatMissingAsZero")).get();
  return row?.valueJson === "true";
}

function withholdIfFees(bundle: DatabaseBundle): boolean {
  const row = bundle.db
    .select()
    .from(settings)
    .where(eq(settings.key, "academics.withholdReportCardIfFeesOutstanding"))
    .get();
  return row?.valueJson === "true";
}

export function computeClassTerm(
  bundle: DatabaseBundle,
  classId: string,
  termId: string,
  actorUserId: string,
) {
  const cls = bundle.db.select().from(classes).where(eq(classes.id, classId)).get();
  if (!cls) throw httpError(404, "NOT_FOUND", "Class not found");
  const level = bundle.db.select().from(levels).where(eq(levels.id, cls.levelId)).get();
  const section = level
    ? bundle.db.select().from(sections).where(eq(sections.id, level.sectionId)).get()
    : undefined;
  const nursery = /nursery/i.test(section?.name ?? "");
  const scale = section
    ? bundle.db.select().from(gradingScales).where(eq(gradingScales.sectionId, section.id)).get()
    : undefined;
  const bands = scale
    ? bundle.db.select().from(gradingScaleBands).where(eq(gradingScaleBands.scaleId, scale.id)).all()
    : [];
  const offerings = bundle.db.select().from(classSubjects).where(eq(classSubjects.classId, classId)).all();
  const types = bundle.db.select().from(assessmentTypes).where(eq(assessmentTypes.termId, termId)).all();
  const roster = bundle.db.select().from(enrolments).where(eq(enrolments.classId, classId)).all();
  const missingAsZero = treatMissingAsZero(bundle);
  const pupilsRows = roster.map((e) => {
    const subjectsForPupil = offerings.map((offering) => {
      const subject = bundle.db.select().from(subjects).where(eq(subjects.id, offering.subjectId)).get();
      const related = bundle.db
        .select()
        .from(assessments)
        .all()
        .filter((a) => a.classSubjectId === offering.id && types.some((t) => t.id === a.typeId));
      const markInputs: AssessmentMark[] = related.map((assessment) => {
        const type = types.find((t) => t.id === assessment.typeId);
        const mark = bundle.db
          .select()
          .from(marks)
          .where(and(eq(marks.assessmentId, assessment.id), eq(marks.pupilId, e.pupilId)))
          .get();
        return {
          score: mark?.score ?? null,
          status: (mark?.status as AssessmentMark["status"]) ?? "absent",
          weight: type?.weight ?? 1,
          maxScore: type?.maxScore ?? 20,
        };
      });
      const averagePercent = subjectAverage(markInputs, missingAsZero);
      const onScale = averagePercent === null || !scale ? null : toScale(averagePercent, scale.scoreOutOf);
      const grade = onScale === null ? null : lookupGrade(onScale, bands);
      return {
        subjectId: offering.subjectId,
        subjectName: subject?.name ?? "",
        coefficient: offering.coefficient,
        averagePercent,
        averageOnScale: onScale,
        letter: grade?.letter ?? null,
        remark: grade?.remark ?? null,
      };
    });
    const termPercent = weightedTermAverage(
      subjectsForPupil.map((s) => ({ averagePercent: s.averagePercent, coefficient: s.coefficient })),
    );
    return {
      pupilId: e.pupilId,
      subjects: subjectsForPupil,
      termPercent,
      termOnScale: termPercent === null || !scale ? null : toScale(termPercent, scale.scoreOutOf),
    };
  });
  const rankable = pupilsRows
    .filter((row) => row.termPercent !== null)
    .map((row) => ({ id: row.pupilId, average: row.termPercent as number }));
  const ranks = nursery ? [] : competitionRanks(rankable);
  const classAverage =
    rankable.length === 0 ? null : rankable.reduce((s, r) => s + r.average, 0) / rankable.length;
  const snapshot = {
    classId,
    termId,
    nursery,
    scoreOutOf: scale?.scoreOutOf ?? 20,
    passMark: scale?.passMark ?? 10,
    classAveragePercent: classAverage,
    classSize: roster.length,
    pupils: pupilsRows.map((row) => ({
      ...row,
      rank: ranks.find((r) => r.id === row.pupilId)?.rank ?? null,
    })),
  };
  const existing = bundle.db
    .select()
    .from(termResults)
    .where(and(eq(termResults.classId, classId), eq(termResults.termId, termId)))
    .get();
  const at = nowIso();
  if (existing) {
    bundle.db
      .update(termResults)
      .set({ snapshotJson: JSON.stringify(snapshot), computedAt: at, computedBy: actorUserId })
      .where(eq(termResults.id, existing.id))
      .run();
  } else {
    bundle.db
      .insert(termResults)
      .values({
        id: createId(),
        classId,
        termId,
        snapshotJson: JSON.stringify(snapshot),
        computedAt: at,
        computedBy: actorUserId,
      })
      .run();
  }
  return snapshot;
}

export function issueReportCard(bundle: DatabaseBundle, pupilId: string, termId: string, actorUserId: string) {
  const term = bundle.db.select().from(terms).where(eq(terms.id, termId)).get();
  if (!term) throw httpError(400, "VALIDATION", "Unknown term");
  const enrolment = bundle.db
    .select()
    .from(enrolments)
    .where(and(eq(enrolments.pupilId, pupilId), eq(enrolments.academicYearId, term.academicYearId)))
    .get();
  if (!enrolment) throw httpError(400, "VALIDATION", "Pupil is not enrolled");
  const snapshot = computeClassTerm(bundle, enrolment.classId, termId, actorUserId);
  const invoice = invoiceForPupilYear(bundle, pupilId, term.academicYearId);
  const feesOutstanding = invoice ? accountForInvoice(bundle, invoice.id).balanceFcfa > 0 : false;
  const withheld = withholdIfFees(bundle) && feesOutstanding;
  const existing = bundle.db
    .select()
    .from(reportCards)
    .where(and(eq(reportCards.pupilId, pupilId), eq(reportCards.termId, termId)))
    .get();
  const id = existing?.id ?? createId();
  if (!existing) {
    bundle.db
      .insert(reportCards)
      .values({
        id,
        pupilId,
        termId,
        withheld,
        verificationCode: randomBytes(8).toString("hex"),
        createdAt: nowIso(),
      })
      .run();
  }
  const pupil = bundle.db.select().from(pupils).where(eq(pupils.id, pupilId)).get();
  const row = snapshot.pupils.find((p) => p.pupilId === pupilId);
  const lines = [
    `${pupil?.givenName ?? ""} ${pupil?.familyName ?? ""}  ${pupil?.admissionNumber ?? ""}`,
    withheld ? "WITHHELD: fees outstanding" : "",
    `Term average: ${row?.termOnScale ?? "—"} / ${snapshot.scoreOutOf}`,
    nurseryLine(snapshot.nursery, row?.rank, snapshot.classSize),
    ...(row?.subjects ?? []).map(
      (s) => `${s.subjectName} coeff ${s.coefficient}  ${s.averageOnScale ?? "—"}  ${s.letter ?? ""} ${s.remark ?? ""}`,
    ),
    `Class average: ${snapshot.classAveragePercent ?? "—"}`,
    "Rank rule: competition (min rank). Missing marks excluded unless setting treats them as zero.",
  ];
  return { id, withheld, pdf: buildTextPdf("Report card", lines.filter(Boolean)) };
}

function nurseryLine(nursery: boolean, rank: number | null | undefined, classSize: number): string {
  if (nursery) return "Nursery: competency comments, no numeric rank.";
  return `Rank: ${rank ?? "—"} / ${classSize}`;
}
