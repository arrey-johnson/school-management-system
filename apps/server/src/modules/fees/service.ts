import {
  createId,
  DEFAULT_DISCOUNT_APPROVAL_THRESHOLD_FCFA,
  formatFcfa,
  hashIdempotencyBody,
  type feeItemCreateSchema,
  type paymentCreateSchema,
} from "@sms/shared";
import { and, eq } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import type { z } from "zod";
import type { DatabaseBundle } from "../../db/client.js";
import { nextSequence } from "../../db/sequences.js";
import {
  academicYears,
  adjustments,
  approvalRequests,
  cashUps,
  classes,
  enrolments,
  feeItems,
  idempotencyKeys,
  invoiceLines,
  levels,
  paymentAllocations,
  payments,
  periodLocks,
  pupilInvoices,
  pupils,
  receipts,
  reversals,
  schoolProfile,
  sections,
  settings,
  users,
} from "../../db/schema.js";
import { buildTextPdf } from "../../pdf/simple-pdf.js";
import { httpError } from "../../utils/http-error.js";
import { accountForInvoice, invoiceForPupilYear, payableLines, planAllocation } from "./ledger.js";

type FeeItemInput = z.infer<typeof feeItemCreateSchema>;
type PaymentInput = z.infer<typeof paymentCreateSchema>;

function nowIso(): string {
  return new Date().toISOString();
}

function activeYear(bundle: DatabaseBundle) {
  const year = bundle.db.select().from(academicYears).where(eq(academicYears.isActive, true)).get();
  if (!year) throw httpError(400, "VALIDATION", "No active academic year");
  return year;
}

export function discountThreshold(bundle: DatabaseBundle): number {
  const row = bundle.db.select().from(settings).where(eq(settings.key, "finance.discount_threshold_fcfa")).get();
  if (!row) return DEFAULT_DISCOUNT_APPROVAL_THRESHOLD_FCFA;
  const parsed = Number(JSON.parse(row.valueJson) as number);
  return Number.isInteger(parsed) ? parsed : DEFAULT_DISCOUNT_APPROVAL_THRESHOLD_FCFA;
}

export function assertPeriodOpen(bundle: DatabaseBundle, entryDate: string): void {
  const month = entryDate.slice(0, 7);
  const monthLock = bundle.db
    .select()
    .from(periodLocks)
    .where(and(eq(periodLocks.kind, "month"), eq(periodLocks.key, month)))
    .get();
  if (monthLock) throw httpError(409, "PERIOD_LOCKED", `Month ${month} is locked`);
}

export function assertCashDayOpen(bundle: DatabaseBundle, cashierUserId: string, day: string): void {
  const closed = bundle.db
    .select()
    .from(cashUps)
    .where(and(eq(cashUps.cashierUserId, cashierUserId), eq(cashUps.day, day)))
    .get();
  if (closed && !closed.reopenApprovalId) {
    throw httpError(409, "PERIOD_LOCKED", "Cash-up is closed for this cashier and day");
  }
}

export function createFeeItem(bundle: DatabaseBundle, input: FeeItemInput, actorUserId: string): { id: string } {
  const exists = bundle.db.select().from(feeItems).where(eq(feeItems.code, input.code)).get();
  if (exists) throw httpError(409, "CONFLICT", "Fee item code already exists");
  const id = createId();
  const at = nowIso();
  bundle.db
    .insert(feeItems)
    .values({
      id,
      code: input.code,
      name: input.name,
      amountFcfa: input.amountFcfa,
      mandatory: input.mandatory,
      scope: input.scope,
      academicYearId: input.academicYearId,
      termId: input.termId ?? null,
      sectionId: input.sectionId ?? null,
      levelId: input.levelId ?? null,
      classId: input.classId ?? null,
      createdAt: at,
      updatedAt: at,
      createdBy: actorUserId,
      updatedBy: actorUserId,
    })
    .run();
  return { id };
}

function classContext(bundle: DatabaseBundle, classId: string) {
  const cls = bundle.db.select().from(classes).where(eq(classes.id, classId)).get();
  if (!cls) throw httpError(400, "VALIDATION", "Unknown class");
  const level = bundle.db.select().from(levels).where(eq(levels.id, cls.levelId)).get();
  const section = level
    ? bundle.db.select().from(sections).where(eq(sections.id, level.sectionId)).get()
    : undefined;
  return { cls, level, section };
}

function itemApplies(
  item: typeof feeItems.$inferSelect,
  yearId: string,
  sectionId: string | undefined,
  levelId: string | undefined,
  classId: string,
): boolean {
  if (item.archivedAt) return false;
  if (item.academicYearId !== yearId) return false;
  if (item.sectionId && item.sectionId !== sectionId) return false;
  if (item.levelId && item.levelId !== levelId) return false;
  if (item.classId && item.classId !== classId) return false;
  return true;
}

export function generateInvoiceForPupil(
  bundle: DatabaseBundle,
  pupilId: string,
  actorUserId: string,
): { invoiceId: string } {
  const year = activeYear(bundle);
  const enrolment = bundle.db
    .select()
    .from(enrolments)
    .where(and(eq(enrolments.pupilId, pupilId), eq(enrolments.academicYearId, year.id)))
    .get();
  if (!enrolment) throw httpError(400, "VALIDATION", "Pupil is not enrolled this year");
  const ctx = classContext(bundle, enrolment.classId);
  let invoice = invoiceForPupilYear(bundle, pupilId, year.id);
  const at = nowIso();
  if (!invoice) {
    const created = {
      id: createId(),
      pupilId,
      academicYearId: year.id,
      createdAt: at,
      createdBy: actorUserId,
    };
    bundle.db.insert(pupilInvoices).values(created).run();
    invoice = created;
  }
  const items = bundle.db.select().from(feeItems).all();
  const existing = bundle.db.select().from(invoiceLines).where(eq(invoiceLines.invoiceId, invoice.id)).all();
  for (const item of items) {
    if (!item.mandatory) continue;
    if (!itemApplies(item, year.id, ctx.section?.id, ctx.level?.id, enrolment.classId)) continue;
    if (existing.some((line) => line.feeItemId === item.id)) continue;
    bundle.db
      .insert(invoiceLines)
      .values({
        id: createId(),
        invoiceId: invoice.id,
        feeItemId: item.id,
        description: item.name,
        amountFcfa: item.amountFcfa,
        createdAt: at,
      })
      .run();
  }
  return { invoiceId: invoice.id };
}

export function addOptionalLine(bundle: DatabaseBundle, invoiceId: string, feeItemId: string): { id: string } {
  const item = bundle.db.select().from(feeItems).where(eq(feeItems.id, feeItemId)).get();
  if (!item) throw httpError(400, "VALIDATION", "Unknown fee item");
  const id = createId();
  bundle.db
    .insert(invoiceLines)
    .values({
      id,
      invoiceId,
      feeItemId: item.id,
      description: item.name,
      amountFcfa: item.amountFcfa,
      createdAt: nowIso(),
    })
    .run();
  return { id };
}

export function createAdjustment(
  bundle: DatabaseBundle,
  input: { invoiceLineId: string; type: string; amountFcfa: number; reason: string },
  actorUserId: string,
): { id: string; status: string; approvalId?: string } {
  const line = bundle.db.select().from(invoiceLines).where(eq(invoiceLines.id, input.invoiceLineId)).get();
  if (!line) throw httpError(400, "VALIDATION", "Unknown invoice line");
  const signed = input.type === "late_fee" ? input.amountFcfa : -input.amountFcfa;
  const needsApproval = input.type !== "late_fee" && Math.abs(signed) >= discountThreshold(bundle);
  const at = nowIso();
  const id = createId();
  let approvalId: string | undefined;
  const status = needsApproval ? "pending" : "applied";
  if (needsApproval) {
    approvalId = createId();
    bundle.db
      .insert(approvalRequests)
      .values({
        id: approvalId,
        kind: "adjustment",
        entityId: id,
        payloadJson: JSON.stringify(input),
        requestedBy: actorUserId,
        status: "pending",
        createdAt: at,
      })
      .run();
  }
  bundle.db
    .insert(adjustments)
    .values({
      id,
      invoiceLineId: input.invoiceLineId,
      type: input.type,
      amountFcfa: signed,
      reason: input.reason,
      status,
      approvalId: approvalId ?? null,
      createdAt: at,
      createdBy: actorUserId,
    })
    .run();
  return { id, status, approvalId };
}

function recordPaymentInner(
  bundle: DatabaseBundle,
  input: PaymentInput,
  actorUserId: string,
  idempotencyKey: string | undefined,
): { paymentId: string; receiptId: string; receiptNumber: string } {
  assertPeriodOpen(bundle, input.entryDate);
  assertCashDayOpen(bundle, actorUserId, input.entryDate);
  const year = activeYear(bundle);
  generateInvoiceForPupil(bundle, input.pupilId, actorUserId);
  const invoice = invoiceForPupilYear(bundle, input.pupilId, year.id);
  if (!invoice) throw httpError(400, "VALIDATION", "Invoice could not be created");
  const sameDay = bundle.db
    .select()
    .from(payments)
    .all()
    .filter(
      (row) =>
        row.pupilId === input.pupilId &&
        row.amountFcfa === input.amountFcfa &&
        row.entryDate === input.entryDate &&
        row.kind === "payment",
    );
  if (sameDay.length > 0 && !input.confirmDuplicate) {
    throw httpError(409, "DUPLICATE", "A payment of this amount already exists for this pupil today");
  }
  const lines = payableLines(bundle, invoice.id);
  const planned = planAllocation(input.amountFcfa, lines, input.lineIds);
  const at = nowIso();
  const paymentId = createId();
  bundle.db
    .insert(payments)
    .values({
      id: paymentId,
      pupilId: input.pupilId,
      invoiceId: invoice.id,
      amountFcfa: input.amountFcfa,
      unallocatedFcfa: planned.unallocatedFcfa,
      kind: "payment",
      channel: input.channel,
      reference: input.reference || null,
      payerName: input.payerName,
      notes: input.notes || null,
      entryDate: input.entryDate,
      recordedBy: actorUserId,
      idempotencyKey: idempotencyKey ?? null,
      createdAt: at,
    })
    .run();
  for (const slice of planned.allocations) {
    bundle.db
      .insert(paymentAllocations)
      .values({
        id: createId(),
        paymentId,
        invoiceLineId: slice.lineId,
        amountFcfa: slice.amountFcfa,
      })
      .run();
  }
  const receiptNumber = nextSequence(bundle, "receipt");
  const receiptId = createId();
  bundle.db
    .insert(receipts)
    .values({
      id: receiptId,
      paymentId,
      number: receiptNumber,
      verificationCode: randomBytes(8).toString("hex"),
      status: "issued",
      reprintCount: 0,
      createdAt: at,
    })
    .run();
  const result = { paymentId, receiptId, receiptNumber };
  if (idempotencyKey) {
    bundle.db
      .insert(idempotencyKeys)
      .values({
        key: idempotencyKey,
        requestHash: hashIdempotencyBody(input),
        responseJson: JSON.stringify(result),
        createdAt: at,
      })
      .run();
  }
  return result;
}

export function recordPayment(
  bundle: DatabaseBundle,
  input: PaymentInput,
  actorUserId: string,
  idempotencyKey?: string,
): { paymentId: string; receiptId: string; receiptNumber: string; replayed?: boolean } {
  if (idempotencyKey) {
    const keyRow = bundle.db.select().from(idempotencyKeys).where(eq(idempotencyKeys.key, idempotencyKey)).get();
    if (keyRow) {
      if (keyRow.requestHash !== hashIdempotencyBody(input)) {
        throw httpError(409, "CONFLICT", "Idempotency key was used with a different body");
      }
      const parsed = JSON.parse(keyRow.responseJson) as {
        paymentId: string;
        receiptId: string;
        receiptNumber: string;
      };
      return { ...parsed, replayed: true };
    }
  }
  if (bundle.sqlite.inTransaction) {
    return recordPaymentInner(bundle, input, actorUserId, idempotencyKey);
  }
  return bundle.sqlite.transaction(() => recordPaymentInner(bundle, input, actorUserId, idempotencyKey))();
}

export function requestReversal(
  bundle: DatabaseBundle,
  paymentId: string,
  reason: string,
  actorUserId: string,
): { approvalId: string } {
  const payment = bundle.db.select().from(payments).where(eq(payments.id, paymentId)).get();
  if (!payment || payment.kind !== "payment") throw httpError(404, "NOT_FOUND", "Payment not found");
  const existing = bundle.db.select().from(reversals).where(eq(reversals.originalPaymentId, paymentId)).get();
  if (existing?.reversalPaymentId) throw httpError(409, "CONFLICT", "Payment already reversed");
  const at = nowIso();
  const reversalId = createId();
  const approvalId = createId();
  bundle.db
    .insert(reversals)
    .values({
      id: reversalId,
      originalPaymentId: paymentId,
      approvalId,
      reason,
      createdAt: at,
      createdBy: actorUserId,
    })
    .run();
  bundle.db
    .insert(approvalRequests)
    .values({
      id: approvalId,
      kind: "reversal",
      entityId: reversalId,
      requestedBy: actorUserId,
      status: "pending",
      reason,
      createdAt: at,
    })
    .run();
  return { approvalId };
}

function applyReversal(bundle: DatabaseBundle, reversalId: string, actorUserId: string): void {
  const reversal = bundle.db.select().from(reversals).where(eq(reversals.id, reversalId)).get();
  if (!reversal) throw httpError(404, "NOT_FOUND", "Reversal not found");
  if (reversal.reversalPaymentId) return;
  const original = bundle.db.select().from(payments).where(eq(payments.id, reversal.originalPaymentId)).get();
  if (!original) throw httpError(404, "NOT_FOUND", "Original payment not found");
  assertPeriodOpen(bundle, new Date().toISOString().slice(0, 10));
  const at = nowIso();
  const reversalPaymentId = createId();
  bundle.db
    .insert(payments)
    .values({
      id: reversalPaymentId,
      pupilId: original.pupilId,
      invoiceId: original.invoiceId,
      amountFcfa: original.amountFcfa,
      unallocatedFcfa: original.unallocatedFcfa,
      kind: "reversal",
      channel: original.channel,
      payerName: original.payerName,
      notes: reversal.reason,
      entryDate: at.slice(0, 10),
      recordedBy: actorUserId,
      originalPaymentId: original.id,
      createdAt: at,
    })
    .run();
  const slices = bundle.db
    .select()
    .from(paymentAllocations)
    .where(eq(paymentAllocations.paymentId, original.id))
    .all();
  for (const slice of slices) {
    bundle.db
      .insert(paymentAllocations)
      .values({
        id: createId(),
        paymentId: reversalPaymentId,
        invoiceLineId: slice.invoiceLineId,
        amountFcfa: -slice.amountFcfa,
      })
      .run();
  }
  bundle.db.update(reversals).set({ reversalPaymentId }).where(eq(reversals.id, reversalId)).run();
  bundle.db
    .update(receipts)
    .set({ status: "reversed" })
    .where(eq(receipts.paymentId, original.id))
    .run();
}

export function decideApproval(
  bundle: DatabaseBundle,
  approvalId: string,
  decision: "approved" | "rejected",
  actorUserId: string,
  reason?: string,
): { ok: true } {
  const row = bundle.db.select().from(approvalRequests).where(eq(approvalRequests.id, approvalId)).get();
  if (!row) throw httpError(404, "NOT_FOUND", "Approval request not found");
  if (row.status !== "pending") throw httpError(409, "CONFLICT", "Already decided");
  if (row.requestedBy === actorUserId) {
    throw httpError(403, "FORBIDDEN", "Maker cannot approve their own request");
  }
  const at = nowIso();
  bundle.db
    .update(approvalRequests)
    .set({ status: decision, decidedBy: actorUserId, decidedAt: at, reason: reason || row.reason })
    .where(eq(approvalRequests.id, approvalId))
    .run();
  if (decision !== "approved") {
    if (row.kind === "adjustment") {
      bundle.db.update(adjustments).set({ status: "rejected" }).where(eq(adjustments.id, row.entityId)).run();
    }
    return { ok: true };
  }
  if (row.kind === "reversal") {
    bundle.sqlite.transaction(() => applyReversal(bundle, row.entityId, actorUserId))();
  }
  if (row.kind === "adjustment") {
    bundle.db.update(adjustments).set({ status: "applied" }).where(eq(adjustments.id, row.entityId)).run();
  }
  if (row.kind === "cashup_reopen") {
    bundle.db
      .update(cashUps)
      .set({ reopenApprovalId: approvalId })
      .where(eq(cashUps.id, row.entityId))
      .run();
  }
  return { ok: true };
}

export function closeCashUp(
  bundle: DatabaseBundle,
  cashierUserId: string,
  day: string,
  countedCashFcfa: number,
  notes: string | undefined,
): { id: string } {
  const existing = bundle.db
    .select()
    .from(cashUps)
    .where(and(eq(cashUps.cashierUserId, cashierUserId), eq(cashUps.day, day)))
    .get();
  if (existing && !existing.reopenApprovalId) throw httpError(409, "CONFLICT", "Cash-up already closed");
  const rows = bundle.db
    .select()
    .from(payments)
    .all()
    .filter((p) => p.recordedBy === cashierUserId && p.entryDate === day && p.kind === "payment");
  const totals: Record<string, number> = {};
  for (const row of rows) {
    totals[row.channel] = (totals[row.channel] ?? 0) + row.amountFcfa;
  }
  const id = existing?.id ?? createId();
  if (existing) {
    bundle.db.delete(cashUps).where(eq(cashUps.id, existing.id)).run();
  }
  bundle.db
    .insert(cashUps)
    .values({
      id,
      cashierUserId,
      day,
      totalsJson: JSON.stringify(totals),
      countedCashFcfa,
      notes: notes || null,
      lockedAt: nowIso(),
      lockedBy: cashierUserId,
    })
    .run();
  return { id };
}

export function requestCashUpReopen(
  bundle: DatabaseBundle,
  cashUpId: string,
  actorUserId: string,
): { approvalId: string } {
  const row = bundle.db.select().from(cashUps).where(eq(cashUps.id, cashUpId)).get();
  if (!row) throw httpError(404, "NOT_FOUND", "Cash-up not found");
  const approvalId = createId();
  bundle.db
    .insert(approvalRequests)
    .values({
      id: approvalId,
      kind: "cashup_reopen",
      entityId: cashUpId,
      requestedBy: actorUserId,
      status: "pending",
      createdAt: nowIso(),
    })
    .run();
  return { approvalId };
}

export function lockPeriod(bundle: DatabaseBundle, kind: string, key: string, actorUserId: string): { id: string } {
  const exists = bundle.db
    .select()
    .from(periodLocks)
    .where(and(eq(periodLocks.kind, kind), eq(periodLocks.key, key)))
    .get();
  if (exists) throw httpError(409, "CONFLICT", "Period already locked");
  const id = createId();
  bundle.db
    .insert(periodLocks)
    .values({ id, kind, key, lockedAt: nowIso(), lockedBy: actorUserId })
    .run();
  return { id };
}

export function receiptPdf(bundle: DatabaseBundle, receiptId: string, reprint: boolean): Buffer {
  const receipt = bundle.db.select().from(receipts).where(eq(receipts.id, receiptId)).get();
  if (!receipt) throw httpError(404, "NOT_FOUND", "Receipt not found");
  if (reprint && receipt.status === "issued") {
    bundle.db
      .update(receipts)
      .set({ status: "duplicate_reprint", reprintCount: receipt.reprintCount + 1 })
      .where(eq(receipts.id, receipt.id))
      .run();
  }
  const payment = bundle.db.select().from(payments).where(eq(payments.id, receipt.paymentId)).get();
  if (!payment) throw httpError(404, "NOT_FOUND", "Payment not found");
  const pupil = bundle.db.select().from(pupils).where(eq(pupils.id, payment.pupilId)).get();
  const cashier = bundle.db.select().from(users).where(eq(users.id, payment.recordedBy)).get();
  const school = bundle.db.select().from(schoolProfile).get();
  const account = accountForInvoice(bundle, payment.invoiceId);
  const slices = bundle.db
    .select()
    .from(paymentAllocations)
    .where(eq(paymentAllocations.paymentId, payment.id))
    .all();
  const lines = slices.map((slice) => {
    const line = bundle.db.select().from(invoiceLines).where(eq(invoiceLines.id, slice.invoiceLineId)).get();
    return `${line?.description ?? "Fee"}  ${formatFcfa(slice.amountFcfa)}`;
  });
  const marks: string[] = [];
  if (receipt.status === "duplicate_reprint" || reprint) marks.push("DUPLICATE");
  if (receipt.status === "reversed") marks.push("REVERSED");
  return buildTextPdf(`Receipt ${receipt.number}`, [
    school?.name ?? "ALL BRIGHT CHILDREN",
    marks.join(" "),
    `Pupil: ${pupil?.givenName ?? ""} ${pupil?.familyName ?? ""}  ${pupil?.admissionNumber ?? ""}`,
    `Amount: ${formatFcfa(payment.amountFcfa)}  Channel: ${payment.channel}`,
    `Payer: ${payment.payerName}  Cashier: ${cashier?.displayName ?? ""}`,
    `Date: ${payment.entryDate}`,
    ...lines,
    `Balance after: ${formatFcfa(account.balanceFcfa)}`,
    `Verify: ${receipt.number} / ${receipt.verificationCode}`,
  ]);
}

export function dashboard(bundle: DatabaseBundle) {
  const year = activeYear(bundle);
  const invoices = bundle.db.select().from(pupilInvoices).where(eq(pupilInvoices.academicYearId, year.id)).all();
  let outstanding = 0;
  let charged = 0;
  for (const invoice of invoices) {
    const account = accountForInvoice(bundle, invoice.id);
    charged += account.netDueFcfa;
    outstanding += Math.max(account.balanceFcfa, 0);
  }
  const today = new Date().toISOString().slice(0, 10);
  const collectedToday = bundle.db
    .select()
    .from(payments)
    .all()
    .filter((p) => p.entryDate === today && p.kind === "payment")
    .reduce((s, p) => s + p.amountFcfa, 0);
  const collectedYear = bundle.db
    .select()
    .from(payments)
    .all()
    .filter((p) => p.kind === "payment")
    .reduce((s, p) => s + p.amountFcfa, 0);
  const reversedYear = bundle.db
    .select()
    .from(payments)
    .all()
    .filter((p) => p.kind === "reversal")
    .reduce((s, p) => s + p.amountFcfa, 0);
  const netCollected = collectedYear - reversedYear;
  const rate = charged === 0 ? 0 : Math.round((netCollected / charged) * 100);
  return {
    chargedFcfa: charged,
    outstandingFcfa: outstanding,
    collectedTodayFcfa: collectedToday,
    collectedYearFcfa: netCollected,
    collectionRatePercent: rate,
  };
}

export function arrears(bundle: DatabaseBundle) {
  const year = activeYear(bundle);
  const invoices = bundle.db.select().from(pupilInvoices).where(eq(pupilInvoices.academicYearId, year.id)).all();
  const items = [];
  for (const invoice of invoices) {
    const account = accountForInvoice(bundle, invoice.id);
    if (account.balanceFcfa <= 0) continue;
    const pupil = bundle.db.select().from(pupils).where(eq(pupils.id, invoice.pupilId)).get();
    items.push({
      pupilId: invoice.pupilId,
      invoiceId: invoice.id,
      admissionNumber: pupil?.admissionNumber,
      name: `${pupil?.givenName ?? ""} ${pupil?.familyName ?? ""}`.trim(),
      balanceFcfa: account.balanceFcfa,
      status: account.status,
    });
  }
  return { items };
}

export function reminderText(bundle: DatabaseBundle, pupilId: string): { text: string } {
  const year = activeYear(bundle);
  const invoice = invoiceForPupilYear(bundle, pupilId, year.id);
  if (!invoice) throw httpError(404, "NOT_FOUND", "No invoice");
  const pupil = bundle.db.select().from(pupils).where(eq(pupils.id, pupilId)).get();
  const account = accountForInvoice(bundle, invoice.id);
  const school = bundle.db.select().from(schoolProfile).get();
  return {
    text: `${school?.name ?? "School"}: Dear guardian of ${pupil?.givenName ?? ""} ${pupil?.familyName ?? ""}, the outstanding fee balance is ${formatFcfa(account.balanceFcfa)}. Please pay at the bursar office.`,
  };
}
