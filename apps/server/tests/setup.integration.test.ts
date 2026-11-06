import { CSRF_HEADER } from "@sms/shared";
import { afterEach, describe, expect, it } from "vitest";
import { bootstrapAndLogin, startTestApp } from "./helpers.js";

const apps: Array<{ app: { close: () => Promise<void> } }> = [];

afterEach(async () => {
  while (apps.length) {
    const item = apps.pop();
    if (item) await item.app.close();
  }
});

describe("first-run wizard", () => {
  it("completes school profile, year, and setup flag", async () => {
    const built = await startTestApp();
    apps.push(built);
    const session = await bootstrapAndLogin(built.app);
    const headers = { cookie: session.cookies, [CSRF_HEADER]: session.csrf };

    const school = await built.app.inject({
      method: "POST",
      url: "/api/v1/setup/school",
      headers,
      payload: {
        name: "ALL BRIGHT CHILDREN",
        motto: "Learn and shine",
        address: "Yaounde",
        phone: "600000000",
        email: "office@abc.school",
      },
    });
    expect(school.statusCode).toBe(200);

    const year = await built.app.inject({
      method: "POST",
      url: "/api/v1/setup/academic-year",
      headers,
      payload: {
        name: "2026/2027",
        startDate: "2026-09-01",
        endDate: "2027-06-30",
        terms: [
          { name: "Term 1", startDate: "2026-09-01", endDate: "2026-12-15" },
          { name: "Term 2", startDate: "2027-01-08", endDate: "2027-03-31" },
          { name: "Term 3", startDate: "2027-04-14", endDate: "2027-06-30" },
        ],
      },
    });
    expect(year.statusCode).toBe(200);

    const complete = await built.app.inject({
      method: "POST",
      url: "/api/v1/setup/complete",
      headers,
    });
    expect(complete.statusCode).toBe(200);

    const status = await built.app.inject({ method: "GET", url: "/api/v1/setup/status" });
    expect(status.json().complete).toBe(true);

    const verify = await built.app.inject({
      method: "POST",
      url: "/api/v1/audit/verify",
      headers,
    });
    expect(verify.statusCode).toBe(200);
    expect(verify.json().ok).toBe(true);
    expect(verify.json().checked).toBeGreaterThan(0);
  });
});
