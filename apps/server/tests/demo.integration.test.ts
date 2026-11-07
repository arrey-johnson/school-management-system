import { CSRF_HEADER, DEMO_LOAD_CONFIRMATION, DEMO_PASSWORD, DEMO_RESET_CONFIRMATION } from "@sms/shared";
import { afterEach, describe, expect, it } from "vitest";
import { bootstrapAndLogin, completeWizard, mergeCookies, startTestApp } from "./helpers.js";

const apps: Array<{ app: { close: () => Promise<void> } }> = [];

afterEach(async () => {
  while (apps.length) {
    const item = apps.pop();
    if (item) await item.app.close();
  }
});

describe("demo data load and reset", () => {
  it("fills fictional records then clears them for official use", async () => {
    const built = await startTestApp();
    apps.push(built);
    const session = await bootstrapAndLogin(built.app);
    const headers = { cookie: session.cookies, [CSRF_HEADER]: session.csrf };

    const blocked = await built.app.inject({
      method: "POST",
      url: "/api/v1/system/demo/load",
      headers,
      payload: { confirmation: DEMO_LOAD_CONFIRMATION },
    });
    expect(blocked.statusCode).toBe(400);

    await completeWizard(built.app, session.cookies, session.csrf);

    const deniedPhrase = await built.app.inject({
      method: "POST",
      url: "/api/v1/system/demo/load",
      headers,
      payload: { confirmation: "please" },
    });
    expect(deniedPhrase.statusCode).toBe(400);

    const loaded = await built.app.inject({
      method: "POST",
      url: "/api/v1/system/demo/load",
      headers,
      payload: { confirmation: DEMO_LOAD_CONFIRMATION },
    });
    expect(loaded.statusCode).toBe(200);
    const counts = loaded.json() as { counts: { pupils: number; staff: number; users: number } };
    expect(counts.counts.pupils).toBeGreaterThan(0);
    expect(counts.counts.staff).toBeGreaterThan(0);
    expect(counts.counts.users).toBe(6);

    const pupils = await built.app.inject({ method: "GET", url: "/api/v1/pupils?pageSize=50", headers });
    expect(pupils.statusCode).toBe(200);
    expect((pupils.json() as { total: number }).total).toBe(counts.counts.pupils);

    const login = await built.app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      headers,
      payload: { username: "demo.bursar", password: DEMO_PASSWORD },
    });
    expect(login.statusCode).toBe(200);

    const again = await built.app.inject({
      method: "POST",
      url: "/api/v1/system/demo/load",
      headers,
      payload: { confirmation: DEMO_LOAD_CONFIRMATION },
    });
    expect(again.statusCode).toBe(409);

    const reset = await built.app.inject({
      method: "POST",
      url: "/api/v1/system/demo/reset",
      headers,
      payload: { confirmation: DEMO_RESET_CONFIRMATION },
    });
    expect(reset.statusCode).toBe(200);

    const after = await built.app.inject({ method: "GET", url: "/api/v1/pupils?pageSize=50", headers });
    expect((after.json() as { total: number }).total).toBe(0);

    const school = await built.app.inject({ method: "GET", url: "/api/v1/school", headers });
    expect(school.json()).toMatchObject({ school: { name: "ALL BRIGHT CHILDREN" } });

    const users = await built.app.inject({ method: "GET", url: "/api/v1/users", headers });
    const names = (users.json() as { items: { username: string }[] }).items.map((row) => row.username);
    expect(names).toContain("admin");
    expect(names.some((name) => name.startsWith("demo."))).toBe(false);

    const bursarGone = await built.app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      headers,
      payload: { username: "demo.bursar", password: DEMO_PASSWORD },
    });
    expect(bursarGone.statusCode).toBe(401);

    const status = await built.app.inject({ method: "GET", url: "/api/v1/system/demo", headers });
    expect(status.json()).toMatchObject({ loaded: false, counts: { pupils: 0, staff: 0, users: 0 } });
  });

  it("rejects a bursar from loading demo data", async () => {
    const built = await startTestApp();
    apps.push(built);
    const session = await bootstrapAndLogin(built.app);
    await completeWizard(built.app, session.cookies, session.csrf);
    const admin = { cookie: session.cookies, [CSRF_HEADER]: session.csrf };
    const created = await built.app.inject({
      method: "POST",
      url: "/api/v1/users",
      headers: admin,
      payload: {
        username: "bursar1",
        password: "BursarPass1",
        displayName: "Bursar",
        roleSlug: "bursar",
      },
    });
    expect(created.statusCode).toBe(200);
    const csrf = await built.app.inject({ method: "GET", url: "/api/v1/auth/csrf" });
    const csrfCookie = Array.isArray(csrf.headers["set-cookie"])
      ? csrf.headers["set-cookie"].join("; ")
      : String(csrf.headers["set-cookie"]);
    const login = await built.app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      headers: {
        cookie: csrfCookie,
        [CSRF_HEADER]: csrf.json().csrfToken as string,
      },
      payload: { username: "bursar1", password: "BursarPass1" },
    });
    expect(login.statusCode).toBe(200);
    const csrf2 = await built.app.inject({ method: "GET", url: "/api/v1/auth/csrf" });
    const denied = await built.app.inject({
      method: "POST",
      url: "/api/v1/system/demo/load",
      headers: {
        cookie: mergeCookies(
          csrfCookie,
          Array.isArray(login.headers["set-cookie"])
            ? login.headers["set-cookie"].join("; ")
            : String(login.headers["set-cookie"]),
          Array.isArray(csrf2.headers["set-cookie"])
            ? csrf2.headers["set-cookie"].join("; ")
            : String(csrf2.headers["set-cookie"]),
        ),
        [CSRF_HEADER]: csrf2.json().csrfToken as string,
      },
      payload: { confirmation: DEMO_LOAD_CONFIRMATION },
    });
    expect(denied.statusCode).toBe(403);
  });
});
