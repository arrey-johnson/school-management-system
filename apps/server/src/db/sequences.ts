import { peekNextNumber } from "@sms/shared";
import { eq } from "drizzle-orm";
import type { DatabaseBundle } from "./client.js";
import { numberSequences } from "./schema.js";

export function nextSequence(bundle: DatabaseBundle, name: string): string {
  return bundle.sqlite.transaction(() => {
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
  })();
}
