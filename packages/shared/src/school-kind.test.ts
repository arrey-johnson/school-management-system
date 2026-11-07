import { describe, expect, it } from "vitest";
import { sectionsForSchoolKind } from "./school-kind.js";

describe("school kind sections", () => {
  it("gives nursery and primary classes for a primary school", () => {
    const names = sectionsForSchoolKind("primary").flatMap((s) => [s.name, ...s.levels]);
    expect(names).toContain("Class 1");
    expect(names).toContain("Nursery 1");
    expect(names).not.toContain("Form 1");
  });

  it("gives forms only for a secondary school", () => {
    const names = sectionsForSchoolKind("secondary").flatMap((s) => [s.name, ...s.levels]);
    expect(names).toContain("Form 1");
    expect(names).toContain("Upper Sixth");
    expect(names).not.toContain("Class 1");
  });
});
