export type GradeBand = { minScore: number; maxScore: number; letter: string; remark: string };

export type MarkStatus = "present" | "absent" | "excused";

export type AssessmentMark = {
  score: number | null;
  status: MarkStatus;
  weight: number;
  maxScore: number;
};

export function lookupGrade(scoreOnScale: number, bands: GradeBand[]): GradeBand | null {
  return bands.find((band) => scoreOnScale >= band.minScore && scoreOnScale <= band.maxScore) ?? null;
}

export function percentFromMark(mark: AssessmentMark): number | null {
  if (mark.status !== "present" || mark.score === null) return null;
  if (mark.maxScore <= 0) return 0;
  return (mark.score / mark.maxScore) * 100;
}

export function subjectAverage(marks: AssessmentMark[], treatMissingAsZero = false): number | null {
  if (marks.length === 0) return null;
  let weighted = 0;
  let weightSum = 0;
  for (const mark of marks) {
    const pct = percentFromMark(mark);
    if (pct === null) {
      if (!treatMissingAsZero) continue;
      weighted += 0;
      weightSum += mark.weight;
      continue;
    }
    weighted += pct * mark.weight;
    weightSum += mark.weight;
  }
  if (weightSum === 0) return null;
  return weighted / weightSum;
}

export function weightedTermAverage(
  subjects: { averagePercent: number | null; coefficient: number }[],
): number | null {
  let total = 0;
  let coeff = 0;
  for (const subject of subjects) {
    if (subject.averagePercent === null || subject.coefficient <= 0) continue;
    total += subject.averagePercent * subject.coefficient;
    coeff += subject.coefficient;
  }
  if (coeff === 0) return null;
  return total / coeff;
}

export function toScale(percent: number, scoreOutOf: number): number {
  return (percent / 100) * scoreOutOf;
}

export function competitionRanks(entries: { id: string; average: number }[]): { id: string; rank: number }[] {
  const sorted = [...entries].sort((a, b) => b.average - a.average || a.id.localeCompare(b.id));
  const out: { id: string; rank: number }[] = [];
  let i = 0;
  while (i < sorted.length) {
    const value = sorted[i]!.average;
    let j = i;
    while (j < sorted.length && sorted[j]!.average === value) j += 1;
    const rank = i + 1;
    for (let k = i; k < j; k += 1) {
      out.push({ id: sorted[k]!.id, rank });
    }
    i = j;
  }
  return out;
}

export function passed(percent: number, passMark: number, scoreOutOf: number): boolean {
  if (scoreOutOf <= 0) return false;
  return percent >= (passMark / scoreOutOf) * 100;
}

export function annualAverage(termPercents: number[]): number | null {
  if (termPercents.length === 0) return null;
  return termPercents.reduce((s, n) => s + n, 0) / termPercents.length;
}
