import { describeActivity, type Permission } from "@sms/shared";
import { eq } from "drizzle-orm";
import type { AuthUser } from "../../auth/session.js";
import type { DatabaseBundle } from "../../db/client.js";
import {
  applications,
  assessments,
  auditLog,
  classes,
  enrolments,
  levels,
  payments,
  pupilAttendance,
  pupils,
  sections,
  staff,
  users,
} from "../../db/schema.js";
import { todayIso } from "../../utils/dates.js";
import { teacherClassSubjectIds } from "../academics/service.js";
import { teacherClassIds } from "../attendance/service.js";
import { arrears, dashboard as feesDashboard } from "../fees/service.js";
import { classLabel } from "../pupils/service.js";
import { visibleAnnouncements } from "../admin/service.js";

function can(user: AuthUser, perm: Permission): boolean {
  return user.roleSlug === "super_admin" || user.permissions.includes(perm);
}

export function roleDashboard(bundle: DatabaseBundle, user: AuthUser) {
  const today = todayIso();
  const fee = can(user, "payments:read") ? feesDashboard(bundle) : null;
  const pupilCount = can(user, "pupils:read") ? bundle.db.select().from(pupils).all().filter((p) => p.status === "active").length : null;
  const staffCount = can(user, "staff:read") ? bundle.db.select().from(staff).all().filter((s) => s.status === "active").length : null;

  const trend: { month: string; collectedFcfa: number }[] = [];
  if (fee) {
    const months = new Map<string, number>();
    for (const payment of bundle.db.select().from(payments).all()) {
      if (payment.kind !== "payment") continue;
      const month = payment.entryDate.slice(0, 7);
      months.set(month, (months.get(month) ?? 0) + payment.amountFcfa);
    }
    trend.push(
      ...[...months.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, collectedFcfa]) => ({ month, collectedFcfa })),
    );
  }

  const enrolmentBySection: { section: string; count: number }[] = [];
  if (can(user, "pupils:read")) {
    const map = new Map<string, number>();
    for (const row of bundle.db.select().from(enrolments).all()) {
      const cls = bundle.db.select().from(classes).where(eq(classes.id, row.classId)).get();
      const level = cls ? bundle.db.select().from(levels).where(eq(levels.id, cls.levelId)).get() : undefined;
      const section = level
        ? bundle.db.select().from(sections).where(eq(sections.id, level.sectionId)).get()
        : undefined;
      const name = section?.name ?? "Unknown";
      map.set(name, (map.get(name) ?? 0) + 1);
    }
    enrolmentBySection.push(...[...map.entries()].map(([section, count]) => ({ section, count })));
  }

  const attendanceToday = can(user, "attendance:read")
    ? bundle.db
        .select()
        .from(pupilAttendance)
        .all()
        .filter((row) => row.day === today)
        .reduce(
          (acc, row) => {
            acc.marked += 1;
            if (row.mark === "present") acc.present += 1;
            if (row.mark === "absent") acc.absent += 1;
            return acc;
          },
          { marked: 0, present: 0, absent: 0 },
        )
    : null;

  const consecutiveAbsences: { pupilId: string; name: string; days: number }[] = [];
  if (can(user, "attendance:read")) {
    const byPupil = new Map<string, { day: string; mark: string }[]>();
    for (const row of bundle.db.select().from(pupilAttendance).all()) {
      const list = byPupil.get(row.pupilId) ?? [];
      list.push({ day: row.day, mark: row.mark });
      byPupil.set(row.pupilId, list);
    }
    for (const [pupilId, marks] of byPupil) {
      const sorted = marks.sort((a, b) => b.day.localeCompare(a.day));
      let streak = 0;
      for (const row of sorted) {
        if (row.mark === "absent") streak += 1;
        else break;
      }
      if (streak >= 3) {
        const pupil = bundle.db.select().from(pupils).where(eq(pupils.id, pupilId)).get();
        consecutiveAbsences.push({
          pupilId,
          name: `${pupil?.givenName ?? ""} ${pupil?.familyName ?? ""}`.trim(),
          days: streak,
        });
      }
    }
  }

  const activity = bundle.db
    .select()
    .from(auditLog)
    .all()
    .slice(-20)
    .reverse()
    .map((row) => {
      const actor = row.actorUserId
        ? bundle.db.select().from(users).where(eq(users.id, row.actorUserId)).get()
        : undefined;
      return describeActivity({
        at: row.at,
        module: row.module,
        action: row.action,
        entity: row.entity,
        actorName: actor?.displayName ?? null,
      });
    });

  const topArrears = can(user, "payments:read")
    ? arrears(bundle)
        .items.slice()
        .sort((a, b) => b.balanceFcfa - a.balanceFcfa)
        .slice(0, 5)
    : [];

  const pendingAdmissions = can(user, "admissions:read")
    ? bundle.db
        .select()
        .from(applications)
        .all()
        .filter((row) => row.status === "applied" || row.status === "under_review").length
    : null;

  const scopedClasses = teacherClassIds(bundle, user);
  const teacher = {
    classes:
      scopedClasses === null
        ? []
        : scopedClasses.map((id) => ({ id, label: classLabel(bundle, id) })),
    attendanceToSubmit:
      scopedClasses === null
        ? []
        : scopedClasses.filter((classId) => {
            const rows = bundle.db
              .select()
              .from(pupilAttendance)
              .all()
              .filter((row) => row.classId === classId && row.day === today && row.submitted);
            return rows.length === 0;
          }),
    marksPending: (() => {
      const offerings = teacherClassSubjectIds(bundle, user);
      if (offerings === null) return [];
      return bundle.db
        .select()
        .from(assessments)
        .all()
        .filter((row) => row.status === "draft" && offerings.includes(row.classSubjectId))
        .map((row) => ({ id: row.id, classSubjectId: row.classSubjectId, status: row.status }));
    })(),
  };

  return {
    roleSlug: user.roleSlug,
    today,
    pupilCount,
    staffCount,
    fees: fee,
    collectionTrend: trend,
    enrolmentBySection,
    attendanceToday,
    consecutiveAbsences,
    activity,
    topArrears,
    pendingAdmissions,
    teacher,
    announcements: visibleAnnouncements(bundle, user),
  };
}
