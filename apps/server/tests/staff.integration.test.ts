import { CSRF_HEADER } from "@sms/shared";
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

describe("staff, payroll, expenses", () => {
  it("hides national ID from headteacher and computes a payroll run", async () => {
    const { built, headers } = await ready();
    const created = await built.app.inject({
      method: "POST",
      url: "/api/v1/staff",
      headers,
      payload: {
        givenName: "Mary",
        familyName: "Teacher",
        sex: "F",
        nationalId: "NID-123456",
        phone: "670111222",
        position: "Teacher",
        hireDate: "2024-09-01",
      },
    });
    expect(created.statusCode).toBe(200);
    const staffId = created.json().id as string;

    const asAdmin = await built.app.inject({ method: "GET", url: `/api/v1/staff/${staffId}`, headers });
    expect(asAdmin.json().staff.nationalId).toBe("NID-123456");

    const head = await loginAs(built, headers, "head1", "HeadPass123", "headteacher");
    const asHead = await built.app.inject({ method: "GET", url: `/api/v1/staff/${staffId}`, headers: head });
    expect(asHead.statusCode).toBe(200);
    expect(asHead.json().staff.nationalId).toBeNull();

    const hr = await loginAs(built, headers, "hr1", "HrPass12345", "hr");
    const cnps = await built.app.inject({
      method: "POST",
      url: "/api/v1/payroll/components",
      headers: hr,
      payload: { name: "CNPS (configurable)", kind: "deduction", mode: "percent", statutory: true },
    });
    expect(cnps.statusCode).toBe(200);
    const structure = await built.app.inject({
      method: "POST",
      url: "/api/v1/payroll/structures",
      headers: hr,
      payload: {
        staffId,
        baseFcfa: 200_000,
        effectiveFrom: "2026-01-01",
        lines: [{ componentTypeId: cnps.json().id, value: 4 }],
      },
    });
    expect(structure.statusCode).toBe(200);
    const advance = await built.app.inject({
      method: "POST",
      url: "/api/v1/payroll/advances",
      headers: hr,
      payload: { staffId, principalFcfa: 30_000, installmentFcfa: 15_000 },
    });
    expect(advance.statusCode).toBe(200);

    const run = await built.app.inject({
      method: "POST",
      url: "/api/v1/payroll/runs",
      headers: hr,
      payload: { yearMonth: "2026-11" },
    });
    expect(run.statusCode).toBe(200);
    const detail = await built.app.inject({
      method: "GET",
      url: `/api/v1/payroll/runs/${run.json().id as string}`,
      headers: hr,
    });
    expect(detail.json().lines[0].netFcfa).toBe(200_000 - 8_000 - 15_000);

    const selfApprove = await built.app.inject({
      method: "POST",
      url: `/api/v1/payroll/runs/${run.json().id as string}/approve`,
      headers: hr,
    });
    expect(selfApprove.statusCode).toBe(403);
    const approved = await built.app.inject({
      method: "POST",
      url: `/api/v1/payroll/runs/${run.json().id as string}/approve`,
      headers,
    });
    expect(approved.statusCode).toBe(200);

    const adminRun = await built.app.inject({
      method: "POST",
      url: "/api/v1/payroll/runs",
      headers,
      payload: { yearMonth: "2026-12" },
    });
    expect(adminRun.statusCode).toBe(200);
    const adminSelf = await built.app.inject({
      method: "POST",
      url: `/api/v1/payroll/runs/${adminRun.json().id as string}/approve`,
      headers,
    });
    expect(adminSelf.statusCode).toBe(403);
    const proprietor = await loginAs(built, headers, "prop1", "PropPass123", "proprietor");
    const propOk = await built.app.inject({
      method: "POST",
      url: `/api/v1/payroll/runs/${adminRun.json().id as string}/approve`,
      headers: proprietor,
    });
    expect(propOk.statusCode).toBe(200);

    const teacher = await loginAs(built, headers, "teach1", "TeacherPass1", "teacher");
    const denied = await built.app.inject({ method: "GET", url: "/api/v1/staff", headers: teacher });
    expect(denied.statusCode).toBe(403);
  });

  it("moves an expense draft to paid with a second approver", async () => {
    const { built, headers } = await ready();
    const bursar = await loginAs(built, headers, "bursar1", "BursarPass1", "bursar");
    const cat = await built.app.inject({
      method: "POST",
      url: "/api/v1/expenses/categories",
      headers: bursar,
      payload: { name: "Utilities" },
    });
    expect(cat.statusCode).toBe(200);
    const draft = await built.app.inject({
      method: "POST",
      url: "/api/v1/expenses",
      headers: bursar,
      payload: {
        categoryId: cat.json().id,
        entryDate: "2026-11-06",
        amountFcfa: 25_000,
        description: "ENEO bill",
        method: "cash",
      },
    });
    expect(draft.statusCode).toBe(200);
    await built.app.inject({
      method: "POST",
      url: `/api/v1/expenses/${draft.json().id as string}/submit`,
      headers: bursar,
    });
    const self = await built.app.inject({
      method: "POST",
      url: `/api/v1/expenses/${draft.json().id as string}/approve`,
      headers: bursar,
    });
    expect(self.statusCode).toBe(403);
    const ok = await built.app.inject({
      method: "POST",
      url: `/api/v1/expenses/${draft.json().id as string}/approve`,
      headers,
    });
    expect(ok.statusCode).toBe(200);
    const paid = await built.app.inject({
      method: "POST",
      url: `/api/v1/expenses/${draft.json().id as string}/pay`,
      headers: bursar,
    });
    expect(paid.statusCode).toBe(200);
  });
});
