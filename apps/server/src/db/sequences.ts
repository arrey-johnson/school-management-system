import { admissionPrefix, admissionYearToken, peekNextNumber } from "@sms/shared";
import { eq } from "drizzle-orm";
import type { DatabaseBundle } from "./client.js";
import { academicYears, numberSequences } from "./schema.js";

function runInTransaction<T>(bundle: DatabaseBundle, fn: () => T): T {
  if (bundle.sqlite.inTransaction) return fn();
  return bundle.sqlite.transaction(fn)();
}

export function nextSequence(bundle: DatabaseBundle, name: string): string {
  return runInTransaction(bundle, () => {
    const row = bundle.db.select().from(numberSequences).where(eq(numberSequences.name, name)).get();
    if (!row) {
      throw new Error(`Unknown sequence ${name}`);
    }
    const { formatted, nextState } = peekNextNumber({
      name: row.name,
      prefix: row.prefix,
      nextValue: row.nextValue,
      padding: row.padding,
    });
    bundle.db
      .update(numberSequences)
      .set({ nextValue: nextState.nextValue, updatedAt: new Date().toISOString() })
      .where(eq(numberSequences.name, name))
      .run();
    return formatted;
  });
}

export function nextAdmissionNumber(bundle: DatabaseBundle): string {
  return runInTransaction(bundle, () => {
    const year = bundle.db.select().from(academicYears).where(eq(academicYears.isActive, true)).get();
    if (!year) {
      throw new Error("No active academic year");
    }
    const token = admissionYearToken(year.name, year.startDate);
    const name = `admission-${token}`;
    const existing = bundle.db.select().from(numberSequences).where(eq(numberSequences.name, name)).get();
    if (!existing) {
      bundle.db
        .insert(numberSequences)
        .values({
          name,
          prefix: admissionPrefix(token),
          nextValue: 1,
          padding: 4,
          updatedAt: new Date().toISOString(),
        })
        .run();
    }
    return nextSequence(bundle, name);
  });
}
