/** XAF / FCFA has no subunits. All amounts are integer francs. */

export function assertMoneyInt(amount: number, allowNegative = false): void {
  if (!Number.isInteger(amount) || !Number.isSafeInteger(amount)) {
    throw new Error("Money amount must be a safe integer FCFA value");
  }
  if (!allowNegative && amount < 0) {
    throw new Error("Money amount cannot be negative");
  }
}

export function formatFcfa(amount: number): string {
  assertMoneyInt(amount, true);
  const abs = Math.abs(amount);
  const grouped = abs.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const sign = amount < 0 ? "-" : "";
  return `${sign}FCFA ${grouped}`;
}

export function parseFcfaInput(raw: string): number {
  const trimmed = raw.replace(/FCFA/gi, "").replace(/[\s,]/g, "").trim();
  if (!/^-?\d+$/.test(trimmed)) {
    throw new Error("Enter a whole-number FCFA amount");
  }
  const value = Number(trimmed);
  assertMoneyInt(value, true);
  return value;
}
