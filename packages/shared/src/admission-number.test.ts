import { describe, expect, it } from "vitest";
import { admissionPrefix, admissionYearToken } from "./admission-number.js";
import { peekNextNumber } from "./sequences.js";

describe("admission numbers", () => {
  it("uses the first year in 2026/2027 and pads to 4 digits", () => {
    const year = admissionYearToken("2026/2027", "2026-09-01");
    expect(year).toBe("2026");
    const { formatted, nextState } = peekNextNumber({
      name: "admission-2026",
      prefix: admissionPrefix(year),
      nextValue: 1,
      padding: 4,
    });
    expect(formatted).toBe("ABC-2026-0001");
    expect(peekNextNumber(nextState).formatted).toBe("ABC-2026-0002");
  });
});
