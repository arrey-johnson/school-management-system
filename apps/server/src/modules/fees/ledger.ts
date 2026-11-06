import { allocateOldestFirst, deriveAccount, type AllocatableLine } from "@sms/shared";
import { eq } from "drizzle-orm";
import type { DatabaseBundle } from "../../db/client.js";
import {
  adjustments,
  invoiceLines,
  paymentAllocations,
  payments,
  pupilInvoices,
} from "../../db/schema.js";

export function invoiceLinesFor(bundle: DatabaseBundle, invoiceId: string) {
  return bundle.db.select().from(invoiceLines).where(eq(invoiceLines.invoiceId, invoiceId)).all();
}

export function appliedAdjustments(bundle: DatabaseBundle, lineIds: string[]) {
  if (lineIds.length === 0) return [];
  return bundle.db
    .select()
    .from(adjustments)
    .all()
    .filter((row) => lineIds.includes(row.invoiceLineId) && row.status === "applied");
}

export function netAllocationsByLine(bundle: DatabaseBundle, lineIds: string[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const id of lineIds) map.set(id, 0);
  const allocs = bundle.db.select().from(paymentAllocations).all();
  for (const row of allocs) {
    if (!map.has(row.invoiceLineId)) continue;
    map.set(row.invoiceLineId, (map.get(row.invoiceLineId) ?? 0) + row.amountFcfa);
  }
  return map;
}

export function payableLines(bundle: DatabaseBundle, invoiceId: string): AllocatableLine[] {
  const lines = invoiceLinesFor(bundle, invoiceId);
  const adj = appliedAdjustments(
    bundle,
    lines.map((l) => l.id),
  );
  const paid = netAllocationsByLine(
    bundle,
    lines.map((l) => l.id),
  );
  return lines.map((line) => {
    const lineAdj = adj.filter((a) => a.invoiceLineId === line.id).reduce((s, a) => s + a.amountFcfa, 0);
    return {
      id: line.id,
      dueFcfa: line.amountFcfa + lineAdj,
      allocatedFcfa: paid.get(line.id) ?? 0,
      createdAt: line.createdAt,
    };
  });
}

export function accountForInvoice(bundle: DatabaseBundle, invoiceId: string) {
  const lines = payableLines(bundle, invoiceId);
  const dueFcfa = invoiceLinesFor(bundle, invoiceId).reduce((s, l) => s + l.amountFcfa, 0);
  const adj = appliedAdjustments(
    bundle,
    lines.map((l) => l.id),
  ).reduce((s, a) => s + a.amountFcfa, 0);
  const paidRows = bundle.db.select().from(payments).where(eq(payments.invoiceId, invoiceId)).all();
  const paidFcfa = paidRows.reduce((s, p) => s + (p.kind === "reversal" ? -p.amountFcfa : p.amountFcfa), 0);
  return { lines, ...deriveAccount(dueFcfa, adj, paidFcfa) };
}

export function invoiceForPupilYear(bundle: DatabaseBundle, pupilId: string, yearId: string) {
  return bundle.db
    .select()
    .from(pupilInvoices)
    .all()
    .find((row) => row.pupilId === pupilId && row.academicYearId === yearId);
}

export function planAllocation(amountFcfa: number, lines: AllocatableLine[], lineIds?: string[]) {
  const scoped = lineIds?.length ? lines.filter((l) => lineIds.includes(l.id)) : lines;
  return allocateOldestFirst(amountFcfa, scoped);
}
