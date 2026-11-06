import { describe, expect, it } from "vitest";
import { createId } from "./ids.js";

describe("createId", () => {
  it("returns unique uuid-shaped values", () => {
    const a = createId();
    const b = createId();
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(a).not.toBe(b);
  });
});
