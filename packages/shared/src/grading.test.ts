import { describe, expect, it } from "vitest";
import {
  annualAverage,
  competitionRanks,
  lookupGrade,
  passed,
  subjectAverage,
  toScale,
  weightedTermAverage,
} from "./grading.js";

const bands = [
  { minScore: 16, maxScore: 20, letter: "A", remark: "Excellent" },
  { minScore: 14, maxScore: 15, letter: "B", remark: "Very good" },
  { minScore: 10, maxScore: 13, letter: "C", remark: "Average" },
  { minScore: 0, maxScore: 9, letter: "E", remark: "Fail" },
];

describe("grading engine", () => {
  it("averages present marks and skips excused unless missing-as-zero", () => {
    const marks = [
      { score: 16, status: "present" as const, weight: 1, maxScore: 20 },
      { score: 12, status: "present" as const, weight: 1, maxScore: 20 },
      { score: null, status: "excused" as const, weight: 1, maxScore: 20 },
    ];
    expect(subjectAverage(marks)).toBeCloseTo(70);
    expect(subjectAverage(marks, true)).toBeCloseTo((80 + 60 + 0) / 3);
  });

  it("weights subjects by coefficient and uses competition ranks", () => {
    const term = weightedTermAverage([
      { averagePercent: 80, coefficient: 3 },
      { averagePercent: 50, coefficient: 1 },
    ]);
    expect(term).toBe(72.5);
    const ranks = competitionRanks([
      { id: "a", average: 18 },
      { id: "b", average: 16 },
      { id: "c", average: 16 },
      { id: "d", average: 10 },
    ]);
    expect(ranks.map((r) => r.rank)).toEqual([1, 2, 2, 4]);
    expect(lookupGrade(toScale(80, 20), bands)?.letter).toBe("A");
    expect(passed(55, 10, 20)).toBe(true);
    expect(passed(40, 10, 20)).toBe(false);
    expect(annualAverage([70, 80, 90])).toBe(80);
  });
});
