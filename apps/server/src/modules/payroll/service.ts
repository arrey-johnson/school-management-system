import { computePayrollLine, createId, formatFcfa, type SalaryComponentInput } from "@sms/shared";
import { eq } from "drizzle-orm";
import type { DatabaseBundle } from "../../db/client.js";
import {
  advancesLoans,
  payrollLines,
  payrollRuns,
  payslips,
  salaryComponentTypes,
  salaryStructureLines,
  salaryStructures,
  staff,
  staffAttendance,
} from "../../db/schema.js";
import { buildTextPdf } from "../../pdf/simple-pdf.js";
import { httpError } from "../../utils/http-error.js";

function nowIso(): string {
  return new Date().toISOString();
}

export function createComponentType(
  bundle: DatabaseBundle,
  input: { name: string; kind: string; mode: string; statutory: boolean },
): { id: string } {
  const id = createId();
  bundle.db
    .insert(salaryComponentTypes)
    .values({
      id,
      name: input.name,
      kind: input.kind,
      mode: input.mode,
      statutory: input.statutory,
      createdAt: nowIso(),
    })
    .run();
  return { id };
}

export function saveSalaryStructure(
  bundle: DatabaseBundle,
  input: {
    staffId: string;
    baseFcfa: number;
    effectiveFrom: string;
    lines: { componentTypeId: string; value: number }[];
  },
  actorUserId: string,
): { id: string } {
  const person = bundle.db.select().from(staff).where(eq(staff.id, input.staffId)).get();
  if (!person) throw httpError(400, "VALIDATION", "Unknown staff");
  const id = createId();
  bundle.db
    .insert(salaryStructures)
    .values({
      id,
      staffId: input.staffId,
      baseFcfa: input.baseFcfa,
      effectiveFrom: input.effectiveFrom,
      createdAt: nowIso(),
      createdBy: actorUserId,
    })
    .run();
  for (const line of input.lines) {
    bundle.db
      .insert(salaryStructureLines)
      .values({
        id: createId(),
        structureId: id,
        componentTypeId: line.componentTypeId,
        value: line.value,
      })
      .run();
  }
  return { id };
}

export function createAdvance(
  bundle: DatabaseBundle,
  input: { staffId: string; principalFcfa: number; installmentFcfa: number },
  actorUserId: string,
): { id: string } {
  const id = createId();
  bundle.db
    .insert(advancesLoans)
    .values({
      id,
      staffId: input.staffId,
      principalFcfa: input.principalFcfa,
      remainingFcfa: input.principalFcfa,
      installmentFcfa: input.installmentFcfa,
      createdAt: nowIso(),
      createdBy: actorUserId,
    })
    .run();
  return { id };
}

function structureForMonth(bundle: DatabaseBundle, staffId: string, yearMonth: string) {
  const cutoff = `${yearMonth}-01`;
  const rows = bundle.db
    .select()
    .from(salaryStructures)
    .where(eq(salaryStructures.staffId, staffId))
    .all()
    .filter((row) => row.effectiveFrom <= cutoff)
    .sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? 1 : -1));
  return rows[0];
}

function absenceDeduction(bundle: DatabaseBundle, staffId: string, yearMonth: string, baseFcfa: number): number {
  const days = bundle.db
    .select()
    .from(staffAttendance)
    .where(eq(staffAttendance.staffId, staffId))
    .all()
    .filter((row) => row.day.startsWith(yearMonth) && row.mark === "absent").length;
  if (days === 0) return 0;
  return days * Math.round(baseFcfa / 30);
}

export function createAndCalculateRun(
  bundle: DatabaseBundle,
  yearMonth: string,
  actorUserId: string,
  bonusFcfaByStaffId: Record<string, number> = {},
): { id: string } {
  const existing = bundle.db.select().from(payrollRuns).where(eq(payrollRuns.yearMonth, yearMonth)).get();
  if (existing) throw httpError(409, "CONFLICT", "A payroll run already exists for that month");
  const id = createId();
  const at = nowIso();
  return bundle.sqlite.transaction(() => {
    bundle.db
      .insert(payrollRuns)
      .values({
        id,
        yearMonth,
        status: "calculated",
        preparedBy: actorUserId,
        createdAt: at,
        updatedAt: at,
      })
      .run();
    const people = bundle.db.select().from(staff).all().filter((row) => row.status === "active");
    const types = bundle.db.select().from(salaryComponentTypes).all();
    for (const person of people) {
      const structure = structureForMonth(bundle, person.id, yearMonth);
      if (!structure) continue;
      const lines = bundle.db
        .select()
        .from(salaryStructureLines)
        .where(eq(salaryStructureLines.structureId, structure.id))
        .all();
      const components: SalaryComponentInput[] = lines.map((line) => {
        const type = types.find((t) => t.id === line.componentTypeId);
        return {
          name: type?.name ?? "Component",
          kind: (type?.kind ?? "allowance") as SalaryComponentInput["kind"],
          mode: (type?.mode ?? "fixed") as SalaryComponentInput["mode"],
          value: line.value,
        };
      });
      const openAdvance = bundle.db
        .select()
        .from(advancesLoans)
        .where(eq(advancesLoans.staffId, person.id))
        .all()
        .find((row) => row.remainingFcfa > 0);
      const advanceFcfa = openAdvance ? Math.min(openAdvance.installmentFcfa, openAdvance.remainingFcfa) : 0;
      const computed = computePayrollLine(structure.baseFcfa, components, {
        bonusFcfa: bonusFcfaByStaffId[person.id] ?? 0,
        advanceFcfa,
        absenceDeductionFcfa: absenceDeduction(bundle, person.id, yearMonth, structure.baseFcfa),
      });
      if (openAdvance && advanceFcfa > 0) {
        bundle.db
          .update(advancesLoans)
          .set({ remainingFcfa: openAdvance.remainingFcfa - advanceFcfa })
          .where(eq(advancesLoans.id, openAdvance.id))
          .run();
      }
      const lineId = createId();
      bundle.db
        .insert(payrollLines)
        .values({
          id: lineId,
          runId: id,
          staffId: person.id,
          snapshotJson: JSON.stringify(computed),
          grossFcfa: computed.grossFcfa,
          deductionsFcfa: computed.totalDeductionsFcfa,
          netFcfa: computed.netFcfa,
        })
        .run();
      bundle.db.insert(payslips).values({ id: createId(), payrollLineId: lineId, createdAt: at }).run();
    }
    return { id };
  })();
}

export function requestPayrollApproval(bundle: DatabaseBundle, runId: string): void {
  const run = bundle.db.select().from(payrollRuns).where(eq(payrollRuns.id, runId)).get();
  if (!run) throw httpError(404, "NOT_FOUND", "Payroll run not found");
  if (run.status !== "calculated" && run.status !== "reviewed") {
    throw httpError(409, "CONFLICT", "Run is not waiting for approval");
  }
  bundle.db.update(payrollRuns).set({ status: "reviewed", updatedAt: nowIso() }).where(eq(payrollRuns.id, runId)).run();
}

export function approvePayroll(bundle: DatabaseBundle, runId: string, actorUserId: string): void {
  const run = bundle.db.select().from(payrollRuns).where(eq(payrollRuns.id, runId)).get();
  if (!run) throw httpError(404, "NOT_FOUND", "Payroll run not found");
  if (run.status !== "reviewed" && run.status !== "calculated") {
    throw httpError(409, "CONFLICT", "Run cannot be approved");
  }
  if (run.preparedBy === actorUserId) {
    throw httpError(403, "FORBIDDEN", "Maker cannot approve their own payroll run");
  }
  bundle.db
    .update(payrollRuns)
    .set({ status: "approved", approvedBy: actorUserId, updatedAt: nowIso() })
    .where(eq(payrollRuns.id, runId))
    .run();
}

export function markPayrollPaid(bundle: DatabaseBundle, runId: string): void {
  const run = bundle.db.select().from(payrollRuns).where(eq(payrollRuns.id, runId)).get();
  if (!run || run.status !== "approved") throw httpError(409, "CONFLICT", "Approve the run before paying");
  bundle.db.update(payrollRuns).set({ status: "paid", updatedAt: nowIso() }).where(eq(payrollRuns.id, runId)).run();
}

export function lockPayroll(bundle: DatabaseBundle, runId: string): void {
  const run = bundle.db.select().from(payrollRuns).where(eq(payrollRuns.id, runId)).get();
  if (!run || (run.status !== "paid" && run.status !== "approved")) {
    throw httpError(409, "CONFLICT", "Lock is only allowed after approval");
  }
  bundle.db.update(payrollRuns).set({ status: "locked", updatedAt: nowIso() }).where(eq(payrollRuns.id, runId)).run();
}

export function payslipPdf(bundle: DatabaseBundle, lineId: string): Buffer {
  const line = bundle.db.select().from(payrollLines).where(eq(payrollLines.id, lineId)).get();
  if (!line) throw httpError(404, "NOT_FOUND", "Payslip not found");
  const person = bundle.db.select().from(staff).where(eq(staff.id, line.staffId)).get();
  const run = bundle.db.select().from(payrollRuns).where(eq(payrollRuns.id, line.runId)).get();
  const snapshot = JSON.parse(line.snapshotJson) as {
    components: { name: string; amountFcfa: number; kind: string }[];
  };
  return buildTextPdf(`Payslip ${run?.yearMonth ?? ""}`, [
    `${person?.givenName ?? ""} ${person?.familyName ?? ""}  ${person?.position ?? ""}`,
    ...snapshot.components.map((c) => `${c.name} (${c.kind}) ${formatFcfa(c.amountFcfa)}`),
    `Net: ${formatFcfa(line.netFcfa)}`,
    "Statutory rates are configurable settings, not legal advice.",
  ]);
}
