import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { openDatabase } from "../src/db/client.js";
import { seedFoundation } from "../src/db/seed.js";
import { nextSequence } from "../src/db/sequences.js";

describe("number sequences", () => {
  it("allocates gap-free receipt numbers in a transaction", () => {
    const dir = path.join(os.tmpdir(), `sms-seq-${Date.now()}`);
    const bundle = openDatabase(dir);
    seedFoundation(bundle.db);
    expect(nextSequence(bundle, "receipt")).toBe("RC-00001");
    expect(nextSequence(bundle, "receipt")).toBe("RC-00002");
    expect(nextSequence(bundle, "admission")).toBe("ABC-0001");
    bundle.sqlite.close();
  });
});
