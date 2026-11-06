import { assertMoneyInt } from "./money.js";

export type AllocatableLine = {
  id: string;
  dueFcfa: number;
  allocatedFcfa: number;
  createdAt: string;
};

export type AllocationSlice = { lineId: string; amountFcfa: number };

export type AccountStatus = "unpaid" | "partial" | "paid" | "overpaid";

export function lineOutstanding(line: AllocatableLine): number {
  assertMoneyInt(line.dueFcfa, true);
  assertMoneyInt(line.allocatedFcfa, true);
  return line.dueFcfa - line.allocatedFcfa;
}

export function allocateOldestFirst(
  amountFcfa: number,
  lines: AllocatableLine[],
): { allocations: AllocationSlice[]; unallocatedFcfa: number } {
  assertMoneyInt(amountFcfa);
  if (amountFcfa <= 0) {
    throw new Error("Payment amount must be a positive FCFA integer");
  }
  const sorted = [...lines].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  const allocations: AllocationSlice[] = [];
  let left = amountFcfa;
  for (const line of sorted) {
    const open = lineOutstanding(line);
    if (open <= 0) continue;
    const take = Math.min(left, open);
    allocations.push({ lineId: line.id, amountFcfa: take });
    left -= take;
    if (left === 0) break;
  }
  return { allocations, unallocatedFcfa: left };
}

export function deriveAccount(
  dueFcfa: number,
  adjustmentFcfa: number,
  paidFcfa: number,
): { netDueFcfa: number; paidFcfa: number; balanceFcfa: number; status: AccountStatus } {
  assertMoneyInt(dueFcfa, true);
  assertMoneyInt(adjustmentFcfa, true);
  assertMoneyInt(paidFcfa, true);
  const netDueFcfa = dueFcfa + adjustmentFcfa;
  const balanceFcfa = netDueFcfa - paidFcfa;
  let status: AccountStatus;
  if (balanceFcfa < 0) status = "overpaid";
  else if (balanceFcfa === 0) status = "paid";
  else if (paidFcfa === 0) status = "unpaid";
  else status = "partial";
  return { netDueFcfa, paidFcfa, balanceFcfa, status };
}

export function hashIdempotencyBody(body: unknown): string {
  return JSON.stringify(body);
}
