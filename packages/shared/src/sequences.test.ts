import { describe, expect, it } from "vitest";
import { peekNextNumber } from "./sequences.js";

describe("sequences", () => {
  it("formats padded numbers and increments", () => {
    const first = peekNextNumber({
      name: "receipt",
      prefix: "RC-",
      nextValue: 1,
      padding: 5,
    });
    expect(first.formatted).toBe("RC-00001");
    expect(first.nextState.nextValue).toBe(2);
    expect(peekNextNumber(first.nextState).formatted).toBe("RC-00002");
  });
});
