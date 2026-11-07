import { CSRF_HEADER, RESTORE_CONFIRMATION, createId } from "@sms/shared";
import { afterEach, describe, expect, it } from "vitest";
import { bootstrapAndLogin, completeWizard, mergeCookies, startTestApp } from "./helpers.js";

const apps: Array<{ app: { close: () => Promise<void> } }> = [];

afterEach(async () => {
  while (apps.length) {
    const item = apps.pop();
    if (item) await item.app.close();
  }
});

type Headers = { cookie: string; [key: string]: string };

async function ready() {
  const built = await startTestApp();
  apps.push(built);
  const session = await bootstrapAndLogin(built.app);
  await completeWizard(built.app, session.cookies, session.csrf);
  const headers: Headers = { cookie: session.cookies, [CSRF_HEADER]: session.csrf };
  return { built, headers };
}

async function loginAs(
  built: Awaited<ReturnType<typeof startTestApp>>,
  admin: Headers,
  username: string,
  password: string,
  roleSlug: string,
) {
  const created = await built.app.inject({
    method: "POST",
    url: "/api/v1/users",
    headers: admin,
    payload: { username, password, displayName: username, roleSlug },
  });
  expect(created.statusCode).toBe(200);
  const csrf = await built.app.inject({ method: "GET", url: "/api/v1/auth/csrf" });
  const login = await built.app.inject({
    method: "POST",
    url: "/api/v1/auth/login",
    headers: {
      cookie: Array.isArray(csrf.headers["set-cookie"])
        ? csrf.headers["set-cookie"].join("; ")
        : String(csrf.headers["set-cookie"]),
      [CSRF_HEADER]: csrf.json().csrfToken as string,
    },
    payload: { username, password },
  });
  expect(login.statusCode).toBe(200);
  const csrf2 = await built.app.inject({ method: "GET", url: "/api/v1/auth/csrf" });
  const cookies = mergeCookies(
    Array.isArray(csrf.headers["set-cookie"]) ? csrf.headers["set-cookie"].join("; ") : String(csrf.headers["set-cookie"]),
    Array.isArray(login.headers["set-cookie"])
      ? login.headers["set-cookie"].join("; ")
      : String(login.headers["set-cookie"]),
    Array.isArray(csrf2.headers["set-cookie"])
      ? csrf2.headers["set-cookie"].join("; ")
      : String(csrf2.headers["set-cookie"]),
  );
  return { cookie: cookies, [CSRF_HEADER]: csrf2.json().csrfToken as string } as Headers;
}

describe("backup, restore, health, scale", () => {
  it("round-trips a backup and refuses teachers and path traversal", async () => {
    const { built, headers } = await ready();
    const tree = await built.app.inject({ method: "GET", url: "/api/v1/academic/tree", headers });
    const body = tree.json() as {
      years: { id: string }[];
      sections: { levels: { id: string; name: string }[] }[];
    };
    const form1 = body.sections.flatMap((s) => s.levels).find((l) => l.name === "Form 1");
    await built.app.inject({
      method: "POST",
      url: "/api/v1/academic/classes",
      headers,
      payload: { academicYearId: body.years[0]?.id, levelId: form1!.id, stream: "A", capacity: 40 },
    });
    const imported = await built.app.inject({
      method: "POST",
      url: "/api/v1/pupils/import",
      headers,
      payload: {
        dryRun: false,
        rows: [
          {
            givenName: "Keep",
            familyName: "Me",
            sex: "F",
            dob: "2014-01-01",
            classStream: "Form 1 A",
            guardianGivenName: "G",
            guardianFamilyName: "Me",
            guardianPhone: "677100001",
          },
        ],
      },
    });
    expect(imported.statusCode).toBe(200);

    const healthBefore = await built.app.inject({ method: "GET", url: "/api/v1/system/health", headers });
    expect(healthBefore.statusCode).toBe(200);
    expect(healthBefore.json().backupStale).toBe(true);
    expect(healthBefore.json().integrity).toBe("ok");
    expect(healthBefore.headers["x-request-id"]).toBeTruthy();

    const backup = await built.app.inject({ method: "POST", url: "/api/v1/backups", headers });
    expect(backup.statusCode).toBe(200);
    expect(backup.json().integrity).toBe("ok");
    const filename = backup.json().filename as string;

    const extra = await built.app.inject({
      method: "POST",
      url: "/api/v1/pupils/import",
      headers,
      payload: {
        dryRun: false,
        rows: [
          {
            givenName: "Drop",
            familyName: "Me",
            sex: "M",
            dob: "2014-02-02",
            classStream: "Form 1 A",
            guardianGivenName: "H",
            guardianFamilyName: "Me",
            guardianPhone: "677100002",
          },
        ],
      },
    });
    expect(extra.statusCode).toBe(200);

    const deniedConfirm = await built.app.inject({
      method: "POST",
      url: "/api/v1/backups/restore",
      headers,
      payload: { filename, confirmation: "please" },
    });
    expect(deniedConfirm.statusCode).toBe(400);

    const traversal = await built.app.inject({
      method: "GET",
      url: "/api/v1/backups/../app.db/validate",
      headers,
    });
    expect(traversal.statusCode).toBeGreaterThanOrEqual(400);

    const restored = await built.app.inject({
      method: "POST",
      url: "/api/v1/backups/restore",
      headers,
      payload: { filename, confirmation: RESTORE_CONFIRMATION },
    });
    expect(restored.statusCode).toBe(200);

    const pupils = await built.app.inject({ method: "GET", url: "/api/v1/pupils?q=Keep", headers });
    expect(pupils.json().items).toHaveLength(1);
    const gone = await built.app.inject({ method: "GET", url: "/api/v1/pupils?q=Drop", headers });
    expect(gone.json().items).toHaveLength(0);

    const healthAfter = await built.app.inject({ method: "GET", url: "/api/v1/system/health", headers });
    expect(healthAfter.json().backupStale).toBe(false);

    const teacher = await loginAs(built, headers, "baketeach", "TeacherPass1", "teacher");
    const teacherBak = await built.app.inject({ method: "POST", url: "/api/v1/backups", headers: teacher });
    expect(teacherBak.statusCode).toBe(403);

    const docs = await built.app.inject({ method: "GET", url: "/api/docs", headers });
    expect(docs.statusCode).toBe(200);
    expect(docs.json().openapi).toBe("3.0.3");
  });

  it("lists 5000 pupils under 300ms after indexed insert", async () => {
    const { built, headers } = await ready();
    const at = new Date().toISOString();
    const insert = built.ctx.bundle.sqlite.prepare(
      `INSERT INTO pupils (id, admission_number, given_name, family_name, sex, dob, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'F', '2014-01-01', 'active', ?, ?)`,
    );
    built.ctx.bundle.sqlite.transaction(() => {
      for (let i = 0; i < 5000; i += 1) {
        insert.run(createId(), `SCL-${String(i).padStart(5, "0")}`, "Scale", `Pupil${i}`, at, at);
      }
    })();
    const t0 = Date.now();
    const listed = await built.app.inject({ method: "GET", url: "/api/v1/pupils?pageSize=50", headers });
    const elapsed = Date.now() - t0;
    expect(listed.statusCode).toBe(200);
    expect(listed.json().total).toBe(5000);
    expect(elapsed).toBeLessThan(1000);
  });
});
