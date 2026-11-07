import { describe, expect, it } from "vitest";
import { describeActivity } from "./activity.js";

describe("activity stories", () => {
  it("explains a fee payment in plain language", () => {
    const story = describeActivity({
      at: "2026-11-07T08:15:00.000Z",
      module: "fees",
      action: "create",
      actorName: "Mary Bursar",
    });
    expect(story.title).toBe("School fees collected");
    expect(story.summary).toContain("Mary Bursar recorded money received for school fees.");
    expect(story.summary).not.toContain("fees:create");
  });

  it("uses a friendly fallback when the action is unknown", () => {
    const story = describeActivity({
      at: "2026-11-07T08:15:00.000Z",
      module: "pupils",
      action: "update",
      actorName: null,
    });
    expect(story.summary).toContain("A staff member changed a pupil record.");
  });
});
