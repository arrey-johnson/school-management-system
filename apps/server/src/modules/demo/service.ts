import {
  createId,
  DEMO_ACCOUNTS,
  DEMO_PASSWORD,
} from "@sms/shared";
import { and, eq } from "drizzle-orm";
import type { AuthUser } from "../../auth/session.js";
import { hashPassword } from "../../auth/password.js";
import type { DatabaseBundle } from "../../db/client.js";
import {
  academicYears,
  applications,
  classSubjects,
  classes,
  guardians,
  levels,
  numberSequences,
  pupils,
  roles,
  schoolProfile,
  sections,
  settings,
  subjects,
  terms,
  users,
} from "../../db/schema.js";
import { httpError } from "../../utils/http-error.js";
import { todayIso } from "../../utils/dates.js";
import { createAssessment, createAssessmentType, saveMarks } from "../academics/service.js";
import { createAnnouncement, createEvent, saveTemplate } from "../admin/service.js";
import { submitAttendance } from "../attendance/service.js";
import { createCategory, createExpense, setBudget } from "../expenses/service.js";
import { createFeeItem, recordPayment } from "../fees/service.js";
import { createItem, recordMovement } from "../inventory/service.js";
import { createComponentType, saveSalaryStructure } from "../payroll/service.js";
import { createEnrolledPupil } from "../pupils/service.js";
import { assignStaff, createStaff, markAttendance, requestLeave } from "../staff/service.js";

const DEMO_LOADED_KEY = "demo.loaded";
const DEMO_IDS_KEY = "demo.ids";

const GIVEN_NAMES = ["Amina", "Jean", "Marie", "Paul", "Fatima", "Samuel", "Esther", "Claude"];
const FAMILY_NAMES = ["Ngono", "Mbarga", "Fouda", "Nkeng", "Tchoua", "Mandeng", "Etoundi", "Owona"];
const SUBJECTS = [
  { code: "DEMO-ENG", name: "English" },
  { code: "DEMO-MATH", name: "Mathematics" },
  { code: "DEMO-FR", name: "French" },
] as const;

export type DemoIds = {
  users: string[];
  staff: string[];
  pupils: string[];
  guardians: string[];
  classes: string[];
  subjects: string[];
  classSubjects: string[];
  feeItems: string[];
  applications: string[];
  expenseCategories: string[];
  inventoryItems: string[];
  assessmentTypes: string[];
  salaryComponentTypes: string[];
  calendarEvents: string[];
  announcements: string[];
  documentTemplates: string[];
};

function emptyIds(): DemoIds {
  return {
    users: [],
    staff: [],
    pupils: [],
    guardians: [],
    classes: [],
    subjects: [],
    classSubjects: [],
    feeItems: [],
    applications: [],
    expenseCategories: [],
    inventoryItems: [],
    assessmentTypes: [],
    salaryComponentTypes: [],
    calendarEvents: [],
    announcements: [],
    documentTemplates: [],
  };
}

function nowIso(): string {
  return new Date().toISOString();
}

function setting(bundle: DatabaseBundle, key: string): string | undefined {
  return bundle.db.select().from(settings).where(eq(settings.key, key)).get()?.valueJson;
}

function putSetting(bundle: DatabaseBundle, key: string, valueJson: string, actorUserId: string): void {
  const at = nowIso();
  const existing = bundle.db.select().from(settings).where(eq(settings.key, key)).get();
  if (existing) {
    bundle.db.update(settings).set({ valueJson, updatedAt: at, updatedBy: actorUserId }).where(eq(settings.key, key)).run();
    return;
  }
  bundle.db.insert(settings).values({ key, valueJson, updatedAt: at, updatedBy: actorUserId }).run();
}

export function isDemoLoaded(bundle: DatabaseBundle): boolean {
  return setting(bundle, DEMO_LOADED_KEY) === "true";
}

export function readDemoIds(bundle: DatabaseBundle): DemoIds {
  const raw = setting(bundle, DEMO_IDS_KEY);
  if (!raw) return emptyIds();
  try {
    return { ...emptyIds(), ...(JSON.parse(raw) as Partial<DemoIds>) };
  } catch {
    return emptyIds();
  }
}

export function demoStatus(bundle: DatabaseBundle): {
  loaded: boolean;
  setupComplete: boolean;
  counts: { pupils: number; staff: number; users: number };
} {
  const ids = readDemoIds(bundle);
  return {
    loaded: isDemoLoaded(bundle),
    setupComplete: setting(bundle, "setup.complete") === "true",
    counts: {
      pupils: ids.pupils.length,
      staff: ids.staff.length,
      users: ids.users.length,
    },
  };
}

function requireSetup(bundle: DatabaseBundle): void {
  if (setting(bundle, "setup.complete") !== "true") {
    throw httpError(400, "VALIDATION", "Finish first-run setup before loading demo data");
  }
  if (!bundle.db.select().from(schoolProfile).get()) {
    throw httpError(400, "VALIDATION", "School profile is required");
  }
  if (!bundle.db.select().from(academicYears).where(eq(academicYears.isActive, true)).get()) {
    throw httpError(400, "VALIDATION", "An active academic year is required");
  }
}

function requireSuperAdmin(user: AuthUser): void {
  if (user.roleSlug !== "super_admin") {
    throw httpError(403, "FORBIDDEN", "Only Super Admin can load or reset demo data");
  }
}

function dobForLevel(levelName: string, index: number): string {
  const day = String((index % 27) + 1).padStart(2, "0");
  if (/nursery/i.test(levelName)) return `2022-03-${day}`;
  if (/form|sixth/i.test(levelName)) return `2011-05-${day}`;
  return `2016-09-${day}`;
}

function deleteWhereIn(
  bundle: DatabaseBundle,
  sql: string,
  ids: string[],
): void {
  if (ids.length === 0) return;
  const placeholders = ids.map(() => "?").join(",");
  bundle.sqlite.prepare(sql.replace("__IN__", placeholders)).run(...ids);
}

export function resetDemoData(bundle: DatabaseBundle, actor: AuthUser): { ok: true } {
  requireSuperAdmin(actor);
  const ids = readDemoIds(bundle);
  bundle.sqlite.transaction(() => {
    deleteWhereIn(bundle, "DELETE FROM marks WHERE pupil_id IN (__IN__)", ids.pupils);
    deleteWhereIn(bundle, "DELETE FROM marks WHERE assessment_id IN (SELECT id FROM assessments WHERE type_id IN (__IN__))", ids.assessmentTypes);
    deleteWhereIn(bundle, "DELETE FROM marks WHERE assessment_id IN (SELECT id FROM assessments WHERE class_subject_id IN (__IN__))", ids.classSubjects);
    deleteWhereIn(bundle, "DELETE FROM report_cards WHERE pupil_id IN (__IN__)", ids.pupils);
    deleteWhereIn(bundle, "DELETE FROM pupil_attendance WHERE pupil_id IN (__IN__)", ids.pupils);
    deleteWhereIn(bundle, "DELETE FROM assessments WHERE type_id IN (__IN__)", ids.assessmentTypes);
    deleteWhereIn(bundle, "DELETE FROM assessments WHERE class_subject_id IN (__IN__)", ids.classSubjects);
    deleteWhereIn(bundle, "DELETE FROM assessment_types WHERE id IN (__IN__)", ids.assessmentTypes);
    deleteWhereIn(
      bundle,
      "DELETE FROM payment_allocations WHERE payment_id IN (SELECT id FROM payments WHERE pupil_id IN (__IN__))",
      ids.pupils,
    );
    deleteWhereIn(
      bundle,
      "DELETE FROM receipts WHERE payment_id IN (SELECT id FROM payments WHERE pupil_id IN (__IN__))",
      ids.pupils,
    );
    deleteWhereIn(
      bundle,
      "DELETE FROM reversals WHERE original_payment_id IN (SELECT id FROM payments WHERE pupil_id IN (__IN__))",
      ids.pupils,
    );
    deleteWhereIn(bundle, "DELETE FROM payments WHERE pupil_id IN (__IN__)", ids.pupils);
    deleteWhereIn(
      bundle,
      "DELETE FROM adjustments WHERE invoice_line_id IN (SELECT id FROM invoice_lines WHERE invoice_id IN (SELECT id FROM pupil_invoices WHERE pupil_id IN (__IN__)))",
      ids.pupils,
    );
    deleteWhereIn(
      bundle,
      "DELETE FROM invoice_lines WHERE invoice_id IN (SELECT id FROM pupil_invoices WHERE pupil_id IN (__IN__))",
      ids.pupils,
    );
    deleteWhereIn(bundle, "DELETE FROM invoice_lines WHERE fee_item_id IN (__IN__)", ids.feeItems);
    deleteWhereIn(bundle, "DELETE FROM pupil_invoices WHERE pupil_id IN (__IN__)", ids.pupils);
    deleteWhereIn(bundle, "DELETE FROM fee_items WHERE id IN (__IN__)", ids.feeItems);
    deleteWhereIn(bundle, "DELETE FROM enrolments WHERE pupil_id IN (__IN__)", ids.pupils);
    deleteWhereIn(bundle, "DELETE FROM discipline_notes WHERE pupil_id IN (__IN__)", ids.pupils);
    deleteWhereIn(bundle, "DELETE FROM pupil_status_history WHERE pupil_id IN (__IN__)", ids.pupils);
    deleteWhereIn(bundle, "DELETE FROM pupil_guardians WHERE pupil_id IN (__IN__)", ids.pupils);
    deleteWhereIn(bundle, "DELETE FROM pupil_guardians WHERE guardian_id IN (__IN__)", ids.guardians);
    deleteWhereIn(bundle, "DELETE FROM pupils WHERE id IN (__IN__)", ids.pupils);
    deleteWhereIn(bundle, "DELETE FROM applications WHERE id IN (__IN__)", ids.applications);
    deleteWhereIn(bundle, "DELETE FROM guardians WHERE id IN (__IN__)", ids.guardians);
    deleteWhereIn(
      bundle,
      "DELETE FROM payslips WHERE payroll_line_id IN (SELECT id FROM payroll_lines WHERE staff_id IN (__IN__))",
      ids.staff,
    );
    deleteWhereIn(bundle, "DELETE FROM payroll_lines WHERE staff_id IN (__IN__)", ids.staff);
    deleteWhereIn(
      bundle,
      "DELETE FROM salary_structure_lines WHERE structure_id IN (SELECT id FROM salary_structures WHERE staff_id IN (__IN__))",
      ids.staff,
    );
    deleteWhereIn(bundle, "DELETE FROM salary_structures WHERE staff_id IN (__IN__)", ids.staff);
    deleteWhereIn(bundle, "DELETE FROM salary_component_types WHERE id IN (__IN__)", ids.salaryComponentTypes);
    deleteWhereIn(bundle, "DELETE FROM advances_loans WHERE staff_id IN (__IN__)", ids.staff);
    deleteWhereIn(bundle, "DELETE FROM staff_attendance WHERE staff_id IN (__IN__)", ids.staff);
    deleteWhereIn(bundle, "DELETE FROM leaves WHERE staff_id IN (__IN__)", ids.staff);
    deleteWhereIn(bundle, "DELETE FROM staff_assignments WHERE staff_id IN (__IN__)", ids.staff);
    deleteWhereIn(bundle, "DELETE FROM staff_status_history WHERE staff_id IN (__IN__)", ids.staff);
    deleteWhereIn(bundle, "DELETE FROM staff WHERE id IN (__IN__)", ids.staff);
    deleteWhereIn(bundle, "DELETE FROM expenses WHERE category_id IN (__IN__)", ids.expenseCategories);
    deleteWhereIn(bundle, "DELETE FROM budgets WHERE category_id IN (__IN__)", ids.expenseCategories);
    deleteWhereIn(bundle, "DELETE FROM expense_categories WHERE id IN (__IN__)", ids.expenseCategories);
    deleteWhereIn(bundle, "DELETE FROM stock_movements WHERE item_id IN (__IN__)", ids.inventoryItems);
    deleteWhereIn(bundle, "DELETE FROM inventory_items WHERE id IN (__IN__)", ids.inventoryItems);
    deleteWhereIn(bundle, "DELETE FROM calendar_events WHERE id IN (__IN__)", ids.calendarEvents);
    deleteWhereIn(bundle, "DELETE FROM announcements WHERE id IN (__IN__)", ids.announcements);
    deleteWhereIn(bundle, "DELETE FROM document_templates WHERE id IN (__IN__)", ids.documentTemplates);
    deleteWhereIn(bundle, "DELETE FROM class_subjects WHERE id IN (__IN__)", ids.classSubjects);
    deleteWhereIn(bundle, "DELETE FROM classes WHERE id IN (__IN__)", ids.classes);
    deleteWhereIn(bundle, "DELETE FROM subjects WHERE id IN (__IN__)", ids.subjects);
    deleteWhereIn(bundle, "DELETE FROM sessions WHERE user_id IN (__IN__)", ids.users);
    deleteWhereIn(bundle, "DELETE FROM users WHERE id IN (__IN__)", ids.users);
    bundle.sqlite.prepare("DELETE FROM idempotency_keys WHERE key LIKE 'demo-%'").run();
    bundle.sqlite.prepare("DELETE FROM login_attempts WHERE username LIKE 'demo.%'").run();

    if (bundle.db.select().from(pupils).all().length === 0) {
      const admissionRows = bundle.db.select().from(numberSequences).all().filter((row) => row.name.startsWith("admission"));
      for (const row of admissionRows) {
        bundle.db
          .update(numberSequences)
          .set({ nextValue: 1, updatedAt: nowIso() })
          .where(eq(numberSequences.name, row.name))
          .run();
      }
    }
    const receiptCount = bundle.sqlite.prepare("SELECT COUNT(*) AS n FROM receipts").get() as { n: number };
    if (receiptCount.n === 0) {
      bundle.db
        .update(numberSequences)
        .set({ nextValue: 1, updatedAt: nowIso() })
        .where(eq(numberSequences.name, "receipt"))
        .run();
    }

    putSetting(bundle, DEMO_LOADED_KEY, "false", actor.id);
    putSetting(bundle, DEMO_IDS_KEY, JSON.stringify(emptyIds()), actor.id);
  })();
  return { ok: true };
}

export async function loadDemoData(
  bundle: DatabaseBundle,
  actor: AuthUser,
  testMode: boolean,
): Promise<{ counts: { pupils: number; staff: number; users: number } }> {
  requireSuperAdmin(actor);
  requireSetup(bundle);
  if (isDemoLoaded(bundle)) {
    throw httpError(409, "CONFLICT", "Demo data is already loaded. Reset it before loading again");
  }

  const passwordHash = await hashPassword(DEMO_PASSWORD, testMode);
  const at = nowIso();
  const today = todayIso();
  const ids = emptyIds();
  const year = bundle.db.select().from(academicYears).where(eq(academicYears.isActive, true)).get();
  if (!year) throw httpError(400, "VALIDATION", "An active academic year is required");
  const term1 = bundle.db
    .select()
    .from(terms)
    .where(eq(terms.academicYearId, year.id))
    .all()
    .sort((a, b) => a.sequence - b.sequence)[0];
  const visibleSections = bundle.db.select().from(sections).all().filter((section) => !section.archivedAt);
  const visibleSectionIds = new Set(visibleSections.map((section) => section.id));
  const levelRows = bundle.db
    .select()
    .from(levels)
    .all()
    .filter((level) => visibleSectionIds.has(level.sectionId))
    .sort((a, b) => a.sortOrder - b.sortOrder);

  bundle.sqlite.transaction(() => {
    const classIds: string[] = [];
    for (const level of levelRows) {
      const existing = bundle.db
        .select()
        .from(classes)
        .where(and(eq(classes.academicYearId, year.id), eq(classes.levelId, level.id)))
        .all()[0];
      if (existing) {
        classIds.push(existing.id);
        continue;
      }
      const id = createId();
      bundle.db
        .insert(classes)
        .values({
          id,
          academicYearId: year.id,
          levelId: level.id,
          stream: "A",
          capacity: 40,
          createdAt: at,
          updatedAt: at,
          createdBy: actor.id,
          updatedBy: actor.id,
        })
        .run();
      ids.classes.push(id);
      classIds.push(id);
    }

    const subjectIds: string[] = [];
    for (const subject of SUBJECTS) {
      const existing = bundle.db.select().from(subjects).where(eq(subjects.code, subject.code)).get();
      if (existing) {
        subjectIds.push(existing.id);
        continue;
      }
      const id = createId();
      bundle.db
        .insert(subjects)
        .values({ id, code: subject.code, name: subject.name, createdAt: at, updatedAt: at })
        .run();
      ids.subjects.push(id);
      subjectIds.push(id);
    }

    const offeringIds: string[] = [];
    for (const classId of classIds) {
      for (const subjectId of subjectIds) {
        const existing = bundle.db
          .select()
          .from(classSubjects)
          .where(and(eq(classSubjects.classId, classId), eq(classSubjects.subjectId, subjectId)))
          .get();
        if (existing) {
          offeringIds.push(existing.id);
          continue;
        }
        const id = createId();
        bundle.db
          .insert(classSubjects)
          .values({ id, classId, subjectId, coefficient: 1, createdAt: at })
          .run();
        ids.classSubjects.push(id);
        offeringIds.push(id);
      }
    }

    const tuition = createFeeItem(
      bundle,
      {
        code: "DEMO-TUI",
        name: "Demo tuition",
        amountFcfa: 75_000,
        mandatory: true,
        scope: "year",
        academicYearId: year.id,
      },
      actor.id,
    );
    const registration = createFeeItem(
      bundle,
      {
        code: "DEMO-REG",
        name: "Demo registration",
        amountFcfa: 10_000,
        mandatory: true,
        scope: "year",
        academicYearId: year.id,
      },
      actor.id,
    );
    ids.feeItems.push(tuition.id, registration.id);

    for (const account of DEMO_ACCOUNTS) {
      const role = bundle.db.select().from(roles).where(eq(roles.slug, account.roleSlug)).get();
      if (!role) continue;
      const existing = bundle.db.select().from(users).where(eq(users.username, account.username)).get();
      if (existing) {
        ids.users.push(existing.id);
        continue;
      }
      const id = createId();
      bundle.db
        .insert(users)
        .values({
          id,
          username: account.username,
          passwordHash,
          displayName: account.displayName,
          roleId: role.id,
          locale: "en",
          mustChangePassword: false,
          createdAt: at,
          updatedAt: at,
          createdBy: actor.id,
          updatedBy: actor.id,
        })
        .run();
      ids.users.push(id);
    }

    const teacherUser = bundle.db.select().from(users).where(eq(users.username, "demo.teacher")).get();
    const teacherStaff = createStaff(
      bundle,
      {
        givenName: "Grace",
        familyName: "Ngoe",
        sex: "F",
        phone: "670900001",
        email: "grace.ngoe@demo.school",
        department: "Secondary",
        position: "Class teacher",
        employmentType: "full_time",
        hireDate: year.startDate,
        userId: teacherUser?.id,
      },
      actor.id,
    );
    ids.staff.push(teacherStaff.id);
    const extraStaff = [
      { givenName: "Peter", familyName: "Manga", sex: "M" as const, phone: "670900002", position: "Head of Primary" },
      { givenName: "Linda", familyName: "Fokou", sex: "F" as const, phone: "670900003", position: "Accountant" },
      { givenName: "Joseph", familyName: "Bella", sex: "M" as const, phone: "670900004", position: "Store keeper" },
    ];
    for (const person of extraStaff) {
      const created = createStaff(
        bundle,
        {
          ...person,
          department: "Administration",
          employmentType: "full_time",
          hireDate: year.startDate,
        },
        actor.id,
      );
      ids.staff.push(created.id);
    }

    const firstClassId = classIds[0];
    const firstOffering = offeringIds[0];
    if (firstClassId) {
      assignStaff(
        bundle,
        {
          staffId: teacherStaff.id,
          academicYearId: year.id,
          role: "class_teacher",
          classId: firstClassId,
        },
        actor.id,
      );
    }
    if (firstOffering) {
      assignStaff(
        bundle,
        {
          staffId: teacherStaff.id,
          academicYearId: year.id,
          role: "subject_teacher",
          classSubjectId: firstOffering,
        },
        actor.id,
      );
    }
    requestLeave(
      bundle,
      {
        staffId: teacherStaff.id,
        type: "annual",
        startDate: year.startDate,
        endDate: year.startDate,
        reason: "Demo leave record",
      },
      actor.id,
    );
    markAttendance(bundle, { staffId: teacherStaff.id, day: today, mark: "present" }, actor.id);

    const housing = createComponentType(bundle, {
      name: "Demo housing",
      kind: "allowance",
      mode: "fixed",
      statutory: false,
    });
    ids.salaryComponentTypes.push(housing.id);
    saveSalaryStructure(
      bundle,
      {
        staffId: teacherStaff.id,
        baseFcfa: 180_000,
        effectiveFrom: year.startDate,
        lines: [{ componentTypeId: housing.id, value: 20_000 }],
      },
      actor.id,
    );

    let pupilIndex = 0;
    const firstClassPupilIds: string[] = [];
    for (const classId of classIds) {
      const cls = bundle.db.select().from(classes).where(eq(classes.id, classId)).get();
      const level = cls ? bundle.db.select().from(levels).where(eq(levels.id, cls.levelId)).get() : undefined;
      const levelName = level?.name ?? "Class";
      for (let n = 0; n < 2; n += 1) {
        const givenName = GIVEN_NAMES[pupilIndex % GIVEN_NAMES.length] ?? "Amina";
        const familyName = FAMILY_NAMES[Math.floor(pupilIndex / GIVEN_NAMES.length) % FAMILY_NAMES.length] ?? "Ngono";
        const sex = pupilIndex % 2 === 0 ? "F" : "M";
        const created = createEnrolledPupil(bundle, {
          givenName,
          familyName,
          sex,
          dob: dobForLevel(levelName, pupilIndex),
          nationality: "Cameroonian",
          address: "Yaounde",
          classId,
          guardian: {
            givenName: sex === "F" ? "Paul" : "Marie",
            familyName,
            phone: `6708${String(10000 + pupilIndex).slice(-5)}`,
            relationship: sex === "F" ? "Father" : "Mother",
            primaryContact: true,
            feePayer: true,
          },
          actorUserId: actor.id,
        });
        ids.pupils.push(created.id);
        const link = bundle.db.select().from(guardians).all().find((row) => row.phone === `6708${String(10000 + pupilIndex).slice(-5)}`);
        if (link) ids.guardians.push(link.id);
        if (classId === firstClassId) firstClassPupilIds.push(created.id);
        if (n === 0) {
          recordPayment(
            bundle,
            {
              pupilId: created.id,
              amountFcfa: 40_000,
              channel: "cash",
              entryDate: today,
              payerName: `${familyName} family`,
              notes: "Demo payment",
            },
            actor.id,
            `demo-pay-${created.id}`,
          );
        }
        pupilIndex += 1;
      }
    }

    const applyLevel = levelRows[0];
    if (applyLevel) {
      const appId = createId();
      bundle.db
        .insert(applications)
        .values({
          id: appId,
          status: "applied",
          givenName: "Rita",
          familyName: "Demo",
          sex: "F",
          dob: "2018-04-02",
          nationality: "Cameroonian",
          levelId: applyLevel.id,
          notes: "Fictional demo application",
          guardianGivenName: "Alain",
          guardianFamilyName: "Demo",
          guardianPhone: "670800099",
          guardianRelationship: "Father",
          createdAt: at,
          updatedAt: at,
          createdBy: actor.id,
          updatedBy: actor.id,
        })
        .run();
      ids.applications.push(appId);
    }

    const stationery = createCategory(bundle, "Demo stationery");
    ids.expenseCategories.push(stationery.id);
    setBudget(bundle, { categoryId: stationery.id, academicYearId: year.id, amountFcfa: 200_000 });
    createExpense(
      bundle,
      {
        categoryId: stationery.id,
        entryDate: today,
        amountFcfa: 15_000,
        description: "Demo chalk and exercise books",
        vendor: "Local stationer",
        method: "cash",
      },
      actor.id,
    );

    const chalk = createItem(
      bundle,
      {
        sku: "DEMO-CHALK",
        name: "Box of chalk",
        category: "Classroom",
        location: "Store",
        condition: "new",
        acquiredOn: year.startDate,
        costFcfa: 2_500,
        minQty: 2,
      },
      actor.id,
    );
    ids.inventoryItems.push(chalk.id);
    recordMovement(bundle, { itemId: chalk.id, direction: "in", quantity: 10, reason: "Demo stock in" }, actor.id);

    if (term1 && firstOffering) {
      const type = createAssessmentType(
        bundle,
        { name: "Demo Sequence 1", termId: term1.id, weight: 100, maxScore: 20 },
        actor.id,
      );
      ids.assessmentTypes.push(type.id);
      const assessment = createAssessment(bundle, { typeId: type.id, classSubjectId: firstOffering }, actor);
      saveMarks(
        bundle,
        assessment.id,
        firstClassPupilIds.map((pupilId, index) => ({
          pupilId,
          score: 12 + index,
          status: "marked",
        })),
        actor,
      );
    }

    if (firstClassId && firstClassPupilIds.length > 0) {
      submitAttendance(
        bundle,
        {
          classId: firstClassId,
          day: today,
          entries: firstClassPupilIds.map((pupilId, index) => ({
            pupilId,
            mark: index === 0 ? "late" : "present",
          })),
        },
        actor,
      );
    }

    const event = createEvent(
      bundle,
      {
        title: "Demo open day",
        kind: "event",
        startDate: year.startDate,
        endDate: year.startDate,
        notes: "Fictional calendar item",
      },
      actor.id,
    );
    ids.calendarEvents.push(event.id);
    const notice = createAnnouncement(
      bundle,
      {
        title: "Demo announcement",
        body: "This is fictional demo data for testing. Reset it before official use.",
        audience: "all",
      },
      actor.id,
    );
    ids.announcements.push(notice.id);
    const template = saveTemplate(
      bundle,
      {
        name: "Demo reminder letter",
        body: "Dear {{guardianName}}, this is a demo letter for {{pupilName}}.",
      },
      actor.id,
    );
    ids.documentTemplates.push(template.id);

    putSetting(bundle, DEMO_LOADED_KEY, "true", actor.id);
    putSetting(bundle, DEMO_IDS_KEY, JSON.stringify(ids), actor.id);
  })();

  return {
    counts: {
      pupils: ids.pupils.length,
      staff: ids.staff.length,
      users: ids.users.length,
    },
  };
}
