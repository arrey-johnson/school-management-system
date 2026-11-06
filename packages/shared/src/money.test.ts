import { describe, expect, it } from "vitest";
import { assertMoneyInt, formatFcfa, parseFcfaInput } from "./money.js";

describe("money", () => {
  it("formats integer FCFA with grouping", () => {
    expect(formatFcfa(75000)).toBe("FCFA 75,000");
    expect(formatFcfa(-1200)).toBe("-FCFA 1,200");
    expect(formatFcfa(0)).toBe("FCFA 0");
  });

  it("rejects floats", () => {
    expect(() => assertMoneyInt(10.5)).toThrow(/integer/);
    expect(() => parseFcfaInput("10.5")).toThrow();
  });

  it("parses grouped input", () => {
    expect(parseFcfaInput("FCFA 75,000")).toBe(75000);
  });
});
