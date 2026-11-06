import { describe, expect, it } from "vitest";
import { isReportKind, mergeTemplate, toExcelCsv } from "./export.js";

describe("export helpers", () => {
  it("writes a UTF-8 BOM CSV Excel can open", () => {
    const csv = toExcelCsv(["Name", "Amount"], [["Ngono, Amina", 1500], ["Jean", null]]);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain('"Ngono, Amina",1500');
  });

  it("merges letter fields and ignores unknown tokens", () => {
    expect(mergeTemplate("Dear {{ pupil.givenName }} at {{school.name}} {{missing}}", {
      "pupil.givenName": "Amina",
      "school.name": "ABC",
    })).toBe("Dear Amina at ABC ");
    expect(isReportKind("arrears")).toBe(true);
    expect(isReportKind("secret")).toBe(false);
  });
});
