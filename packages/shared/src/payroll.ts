import { assertMoneyInt } from "./money.js";

export type SalaryComponentKind = "allowance" | "deduction";
export type SalaryComponentMode = "fixed" | "percent";

export type SalaryComponentInput = {
  name: string;
  kind: SalaryComponentKind;
  mode: SalaryComponentMode;
  /** Fixed FCFA, or integer percent of base (e.g. 8 = 8%). */
  value: number;
};

export type PayrollExtras = {
  bonusFcfa?: number;
  advanceFcfa?: number;
  absenceDeductionFcfa?: number;
};

export type ComputedComponent = {
  name: string;
  kind: SalaryComponentKind | "bonus" | "advance" | "absence";
  amountFcfa: number;
};

export type PayrollComputation = {
  baseFcfa: number;
  components: ComputedComponent[];
  grossFcfa: number;
  totalDeductionsFcfa: number;
  netFcfa: number;
};

function percentOf(baseFcfa: number, percent: number): number {
  return Math.round((baseFcfa * percent) / 100);
}

export function computePayrollLine(
  baseFcfa: number,
  components: SalaryComponentInput[],
  extras: PayrollExtras = {},
): PayrollComputation {
  assertMoneyInt(baseFcfa);
  const bonusFcfa = extras.bonusFcfa ?? 0;
  const advanceFcfa = extras.advanceFcfa ?? 0;
  const absenceDeductionFcfa = extras.absenceDeductionFcfa ?? 0;
  assertMoneyInt(bonusFcfa);
  assertMoneyInt(advanceFcfa);
  assertMoneyInt(absenceDeductionFcfa);

  const resolved: ComputedComponent[] = [{ name: "Base salary", kind: "allowance", amountFcfa: baseFcfa }];
  for (const component of components) {
    assertMoneyInt(component.value);
    const amountFcfa = component.mode === "percent" ? percentOf(baseFcfa, component.value) : component.value;
    resolved.push({ name: component.name, kind: component.kind, amountFcfa });
  }
  if (bonusFcfa > 0) resolved.push({ name: "Bonus", kind: "bonus", amountFcfa: bonusFcfa });
  if (advanceFcfa > 0) resolved.push({ name: "Advance repayment", kind: "advance", amountFcfa: advanceFcfa });
  if (absenceDeductionFcfa > 0) {
    resolved.push({ name: "Absence deduction", kind: "absence", amountFcfa: absenceDeductionFcfa });
  }

  const additions = resolved
    .filter((row) => row.kind === "allowance" || row.kind === "bonus")
    .reduce((sum, row) => sum + row.amountFcfa, 0);
  const deductions = resolved
    .filter((row) => row.kind === "deduction" || row.kind === "advance" || row.kind === "absence")
    .reduce((sum, row) => sum + row.amountFcfa, 0);
  const netFcfa = additions - deductions;
  return {
    baseFcfa,
    components: resolved,
    grossFcfa: additions,
    totalDeductionsFcfa: deductions,
    netFcfa,
  };
}
