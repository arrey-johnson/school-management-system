import { describe, expect, it } from "vitest";
import { allocateOldestFirst, deriveAccount } from "./fees.js";

describe("fee allocation", () => {
  it("fills oldest lines first and keeps leftover as unallocated", () => {
    const result = allocateOldestFirst(80_000, [
      { id: "b", dueFcfa: 50_000, allocatedFcfa: 0, createdAt: "2026-02-01T00:00:00.000Z" },
      { id: "a", dueFcfa: 40_000, allocatedFcfa: 10_000, createdAt: "2026-01-01T00:00:00.000Z" },
    ]);
    expect(result.allocations).toEqual([
      { lineId: "a", amountFcfa: 30_000 },
      { lineId: "b", amountFcfa: 50_000 },
    ]);
    expect(result.unallocatedFcfa).toBe(0);
  });

  it("records overpayment as unallocated francs", () => {
    const result = allocateOldestFirst(20_000, [
      { id: "a", dueFcfa: 15_000, allocatedFcfa: 0, createdAt: "2026-01-01T00:00:00.000Z" },
    ]);
    expect(result.allocations).toEqual([{ lineId: "a", amountFcfa: 15_000 }]);
    expect(result.unallocatedFcfa).toBe(5_000);
  });
});

describe("fee account status", () => {
  it("derives unpaid, partial, paid, and overpaid", () => {
    expect(deriveAccount(50_000, 0, 0).status).toBe("unpaid");
    expect(deriveAccount(50_000, -5_000, 20_000)).toEqual({
      netDueFcfa: 45_000,
      paidFcfa: 20_000,
      balanceFcfa: 25_000,
      status: "partial",
    });
    expect(deriveAccount(50_000, -10_000, 40_000).status).toBe("paid");
    expect(deriveAccount(50_000, 0, 60_000).status).toBe("overpaid");
  });
});
