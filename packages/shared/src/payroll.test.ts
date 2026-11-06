import { describe, expect, it } from "vitest";
import { computePayrollLine } from "./payroll.js";

describe("payroll computation", () => {
  it("adds fixed and percent allowances then subtracts deductions", () => {
    const result = computePayrollLine(
      200_000,
      [
        { name: "Housing", kind: "allowance", mode: "fixed", value: 25_000 },
        { name: "CNPS (configurable)", kind: "deduction", mode: "percent", value: 4 },
      ],
      { bonusFcfa: 10_000, advanceFcfa: 15_000 },
    );
    expect(result.grossFcfa).toBe(235_000);
    expect(result.totalDeductionsFcfa).toBe(8_000 + 15_000);
    expect(result.netFcfa).toBe(212_000);
  });

  it("rounds percent amounts to whole FCFA", () => {
    const result = computePayrollLine(100_001, [{ name: "Tax", kind: "deduction", mode: "percent", value: 3 }]);
    expect(result.components[1]?.amountFcfa).toBe(3_000);
  });
});
