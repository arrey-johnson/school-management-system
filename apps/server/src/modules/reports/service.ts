import { isReportKind, type Permission, type ReportKind } from "@sms/shared";
import { eq } from "drizzle-orm";
import type { AuthUser } from "../../auth/session.js";
import type { DatabaseBundle } from "../../db/client.js";
import {
  academicYears,
  auditLog,
  classes,
  enrolments,
  expenses,
  levels,
  payments,
  payrollLines,
  payrollRuns,
  pupilAttendance,
  pupils,
  receipts,
  sections,
  staff,
  termResults,
} from "../../db/schema.js";
import { buildTextPdf } from "../../pdf/simple-pdf.js";
import { excelCsvBuffer } from "../../excel/csv.js";
import { httpError } from "../../utils/http-error.js";
import { arrears } from "../fees/service.js";
import { classLabel } from "../pupils/service.js";

export type ReportTable = {
  kind: ReportKind;
  title: string;
  generatedAt: string;
  generatedBy: string;
  headers: string[];
  rows: Array<Array<string | number | null>>;
};

const EXTRA: Record<ReportKind, Permission | null> = {
  pupils: "pupils:read",
  class_register: "pupils:read",
  enrolment: "pupils:read",
  fee_collection: "payments:read",
  arrears: "payments:read",
  receipts: "payments:read",
  expenses: "expenses:read",
  staff: "staff:read",
  payroll: "payroll:view",
  attendance: "attendance:read",
  academics: "academics:read",
  audit: "system:audit",
};

export function assertReportsRead(user: AuthUser): void {
  if (user.roleSlug !== "super_admin" && !user.permissions.includes("reports:read")) {
    throw httpError(403, "FORBIDDEN", "You do not have permission for this action");
  }
}

export function assertReportAccess(user: AuthUser, kind: string, exporting: boolean): ReportKind {
  if (!isReportKind(kind)) throw httpError(400, "VALIDATION", "Unknown report");
  assertReportsRead(user);
  if (exporting && user.roleSlug !== "super_admin" && !user.permissions.includes("reports:export")) {
    throw httpError(403, "FORBIDDEN", "You do not have permission for this action");
  }
  const extra = EXTRA[kind];
  if (extra && user.roleSlug !== "super_admin" && !user.permissions.includes(extra)) {
    throw httpError(403, "FORBIDDEN", "You do not have permission for this action");
  }
  return kind;
}

function stamp(user: AuthUser): { generatedAt: string; generatedBy: string } {
  return { generatedAt: new Date().toISOString(), generatedBy: `${user.displayName} (${user.username})` };
}

export function buildReport(bundle: DatabaseBundle, kind: ReportKind, user: AuthUser, classId?: string): ReportTable {
  const meta = { kind, ...stamp(user) };
  if (kind === "pupils") {
    const items = bundle.db.select().from(pupils).all();
    return {
      ...meta,
      title: "Pupil list",
      headers: ["Admission", "Given name", "Family name", "Sex", "Status"],
      rows: items.map((p) => [p.admissionNumber, p.givenName, p.familyName, p.sex, p.status]),
    };
  }
  if (kind === "class_register") {
    const enrol = bundle.db
      .select()
      .from(enrolments)
      .all()
      .filter((row) => (classId ? row.classId === classId : true));
    return {
      ...meta,
      title: "Class register",
      headers: ["Class", "Admission", "Given name", "Family name", "Sex"],
      rows: enrol.map((row) => {
        const pupil = bundle.db.select().from(pupils).where(eq(pupils.id, row.pupilId)).get();
        return [
          classLabel(bundle, row.classId),
          pupil?.admissionNumber ?? "",
          pupil?.givenName ?? "",
          pupil?.familyName ?? "",
          pupil?.sex ?? "",
        ];
      }),
    };
  }
  if (kind === "enrolment") {
    const year = bundle.db.select().from(academicYears).where(eq(academicYears.isActive, true)).get();
    const enrol = bundle.db
      .select()
      .from(enrolments)
      .all()
      .filter((row) => !year || row.academicYearId === year.id);
    const counts = new Map<string, { f: number; m: number; section: string }>();
    for (const row of enrol) {
      const cls = bundle.db.select().from(classes).where(eq(classes.id, row.classId)).get();
      const level = cls ? bundle.db.select().from(levels).where(eq(levels.id, cls.levelId)).get() : undefined;
      const section = level
        ? bundle.db.select().from(sections).where(eq(sections.id, level.sectionId)).get()
        : undefined;
      const pupil = bundle.db.select().from(pupils).where(eq(pupils.id, row.pupilId)).get();
      const label = classLabel(bundle, row.classId);
      const current = counts.get(label) ?? { f: 0, m: 0, section: section?.name ?? "" };
      if (pupil?.sex === "F") current.f += 1;
      else current.m += 1;
      counts.set(label, current);
    }
    return {
      ...meta,
      title: "Enrolment by class",
      headers: ["Section", "Class", "Female", "Male", "Total"],
      rows: [...counts.entries()].map(([label, c]) => [c.section, label, c.f, c.m, c.f + c.m]),
    };
  }
  if (kind === "fee_collection") {
    const pays = bundle.db.select().from(payments).all().filter((p) => p.kind === "payment");
    return {
      ...meta,
      title: "Fee collection",
      headers: ["Date", "Pupil", "Amount FCFA", "Channel"],
      rows: pays.map((p) => {
        const pupil = bundle.db.select().from(pupils).where(eq(pupils.id, p.pupilId)).get();
        return [p.entryDate, `${pupil?.givenName ?? ""} ${pupil?.familyName ?? ""}`.trim(), p.amountFcfa, p.channel];
      }),
    };
  }
  if (kind === "arrears") {
    const items = arrears(bundle).items;
    return {
      ...meta,
      title: "Arrears",
      headers: ["Admission", "Name", "Balance FCFA", "Status"],
      rows: items.map((item) => [item.admissionNumber ?? "", item.name, item.balanceFcfa, item.status]),
    };
  }
  if (kind === "receipts") {
    const items = bundle.db.select().from(receipts).all();
    return {
      ...meta,
      title: "Receipts register",
      headers: ["Number", "Status", "Created"],
      rows: items.map((r) => [r.number, r.status, r.createdAt]),
    };
  }
  if (kind === "expenses") {
    const items = bundle.db.select().from(expenses).all();
    return {
      ...meta,
      title: "Expenses",
      headers: ["Date", "Amount FCFA", "Status", "Description"],
      rows: items.map((e) => [e.entryDate, e.amountFcfa, e.status, e.description]),
    };
  }
  if (kind === "staff") {
    const canId = user.roleSlug === "super_admin" || user.permissions.includes("staff:national_id");
    const items = bundle.db.select().from(staff).all();
    return {
      ...meta,
      title: "Staff list",
      headers: ["Given name", "Family name", "Position", "Phone", "National ID"],
      rows: items.map((s) => [s.givenName, s.familyName, s.position, s.phone, canId ? s.nationalId : ""]),
    };
  }
  if (kind === "payroll") {
    const runs = bundle.db.select().from(payrollRuns).all();
    const lines = bundle.db.select().from(payrollLines).all();
    return {
      ...meta,
      title: "Payroll summary",
      headers: ["Month", "Status", "Lines", "Net FCFA"],
      rows: runs.map((run) => {
        const runLines = lines.filter((l) => l.runId === run.id);
        return [run.yearMonth, run.status, runLines.length, runLines.reduce((s, l) => s + l.netFcfa, 0)];
      }),
    };
  }
  if (kind === "attendance") {
    const items = bundle.db
      .select()
      .from(pupilAttendance)
      .all()
      .filter((row) => (classId ? row.classId === classId : true));
    return {
      ...meta,
      title: "Attendance",
      headers: ["Day", "Class", "Pupil", "Mark"],
      rows: items.map((row) => {
        const pupil = bundle.db.select().from(pupils).where(eq(pupils.id, row.pupilId)).get();
        return [
          row.day,
          classLabel(bundle, row.classId),
          `${pupil?.givenName ?? ""} ${pupil?.familyName ?? ""}`.trim(),
          row.mark,
        ];
      }),
    };
  }
  if (kind === "academics") {
    const snaps = bundle.db.select().from(termResults).all();
    const rows: Array<Array<string | number | null>> = [];
    for (const snap of snaps) {
      const parsed = JSON.parse(snap.snapshotJson) as {
        pupils?: { pupilId: string; rank: number | null; termOnScale: number | null }[];
        scoreOutOf?: number;
      };
      for (const pupilRow of parsed.pupils ?? []) {
        const pupil = bundle.db.select().from(pupils).where(eq(pupils.id, pupilRow.pupilId)).get();
        rows.push([
          classLabel(bundle, snap.classId),
          pupil?.admissionNumber ?? "",
          pupilRow.termOnScale,
          parsed.scoreOutOf ?? "",
          pupilRow.rank,
        ]);
      }
    }
    return {
      ...meta,
      title: "Academic performance",
      headers: ["Class", "Admission", "Average", "Out of", "Rank"],
      rows,
    };
  }
  const logs = bundle.db.select().from(auditLog).all();
  return {
    ...meta,
    title: "Audit log extract",
    headers: ["At", "Module", "Action", "Entity", "Actor"],
    rows: logs.map((row) => [row.at, row.module, row.action, row.entity, row.actorUserId]),
  };
}

export function reportCsv(table: ReportTable): Buffer {
  return excelCsvBuffer(
    [...table.headers, "Generated by", "Generated at"],
    table.rows.map((row) => [...row, table.generatedBy, table.generatedAt]),
  );
}

export function reportPdf(table: ReportTable): Buffer {
  const lines = [
    `Generated by ${table.generatedBy}`,
    `Generated at ${table.generatedAt}`,
    table.headers.join(" | "),
    ...table.rows.slice(0, 40).map((row) => row.map((cell) => cell ?? "").join(" | ")),
  ];
  if (table.rows.length > 40) lines.push(`… ${table.rows.length - 40} more rows in Excel export`);
  return buildTextPdf(table.title, lines);
}
