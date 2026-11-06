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

describe("teacher cannot manage users", () => {
  it("returns 403 for a teacher session on /users", async () => {
    const built = await startTestApp();
    apps.push(built);
    const admin = await bootstrapAndLogin(built.app);
    const create = await built.app.inject({
      method: "POST",
      url: "/api/v1/users",
      headers: { cookie: admin.cookies, [CSRF_HEADER]: admin.csrf },
      payload: {
        username: "teacher1",
        password: "TeacherPass1",
        displayName: "Mary Teacher",
        roleSlug: "teacher",
      },
    });
    expect(create.statusCode).toBe(200);

    const csrf = await built.app.inject({ method: "GET", url: "/api/v1/auth/csrf" });
    const token = csrf.json().csrfToken as string;
    const cookie = csrf.headers["set-cookie"];
    const login = await built.app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      headers: {
        cookie: Array.isArray(cookie) ? cookie.join("; ") : String(cookie),
        [CSRF_HEADER]: token,
      },
      payload: { username: "teacher1", password: "TeacherPass1" },
    });
    expect(login.statusCode).toBe(200);
    const teacherCookies = [cookie, login.headers["set-cookie"]].flat().filter(Boolean).join("; ");
    const denied = await built.app.inject({
      method: "GET",
      url: "/api/v1/users",
      headers: { cookie: teacherCookies },
    });
    expect(denied.statusCode).toBe(403);
  });
});
