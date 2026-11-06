import { CSRF_HEADER } from "@sms/shared";
import { afterEach, describe, expect, it } from "vitest";
import { bootstrapAndLogin, csrfToken, startTestApp } from "./helpers.js";

const apps: Array<{ app: { close: () => Promise<void> } }> = [];

afterEach(async () => {
  while (apps.length) {
    const item = apps.pop();
    if (item) await item.app.close();
  }
});

describe("auth and rbac", () => {
  it("bootstraps, logs in, and returns the current user", async () => {
    const built = await startTestApp();
    apps.push(built);
    const session = await bootstrapAndLogin(built.app);
    expect(session.bootStatus).toBe(200);
    expect(session.loginStatus).toBe(200);
    const me = await built.app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
      headers: { cookie: session.cookies },
    });
    expect(me.statusCode).toBe(200);
    expect(me.json().user.username).toBe("admin");
    expect(me.json().user.roleSlug).toBe("super_admin");
  });

  it("locks the account after five failed logins", async () => {
    const built = await startTestApp();
    apps.push(built);
    const session = await bootstrapAndLogin(built.app);
    expect(session.loginStatus).toBe(200);
    await built.app.inject({
      method: "POST",
      url: "/api/v1/auth/logout",
      headers: { cookie: session.cookies },
    });

    let lastStatus = 0;
    for (let i = 0; i < 5; i += 1) {
      const csrf = await csrfToken(built.app);
      const res = await built.app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        headers: { cookie: csrf.cookie, [CSRF_HEADER]: csrf.token },
        payload: { username: "admin", password: "wrong-password" },
      });
      lastStatus = res.statusCode;
    }
    expect(lastStatus).toBe(423);
  });

  it("denies user listing without a session", async () => {
    const built = await startTestApp();
    apps.push(built);
    const res = await built.app.inject({ method: "GET", url: "/api/v1/users" });
    expect(res.statusCode).toBe(401);
  });
});
