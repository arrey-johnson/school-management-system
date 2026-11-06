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

describe("reports, inventory, search, dashboard", () => {
  it("tracks stock from movements, exports reports, and scopes search", async () => {
    const { built, headers } = await ready();
    const tree = await built.app.inject({ method: "GET", url: "/api/v1/academic/tree", headers });
    const body = tree.json() as {
      years: { id: string }[];
      sections: { levels: { id: string; name: string }[] }[];
    };
    const form1 = body.sections.flatMap((s) => s.levels).find((l) => l.name === "Form 1");
    const createdClass = await built.app.inject({
      method: "POST",
      url: "/api/v1/academic/classes",
      headers,
      payload: { academicYearId: body.years[0]?.id, levelId: form1!.id, stream: "A", capacity: 40 },
    });
    expect(createdClass.statusCode).toBe(200);
    const imported = await built.app.inject({
      method: "POST",
      url: "/api/v1/pupils/import",
      headers,
      payload: {
        dryRun: false,
        rows: [
          {
            givenName: "Amina",
            familyName: "Searchme",
            sex: "F",
            dob: "2014-01-01",
            classStream: "Form 1 A",
            guardianGivenName: "Paul",
            guardianFamilyName: "Searchme",
            guardianPhone: "677888001",
          },
        ],
      },
    });
    expect(imported.statusCode).toBe(200);

    const item = await built.app.inject({
      method: "POST",
      url: "/api/v1/inventory",
      headers,
      payload: {
        sku: "CHALK-01",
        name: "Chalk box",
        category: "Stationery",
        location: "Store",
        condition: "new",
        acquiredOn: "2026-09-01",
        costFcfa: 2500,
        minQty: 5,
      },
    });
    expect(item.statusCode).toBe(200);
    const itemId = item.json().id as string;
    const inbound = await built.app.inject({
      method: "POST",
      url: "/api/v1/inventory/movements",
      headers,
      payload: { itemId, direction: "in", quantity: 10, reason: "Delivery" },
    });
    expect(inbound.statusCode).toBe(200);
    expect(inbound.json().quantity).toBe(10);
    const tooMuch = await built.app.inject({
      method: "POST",
      url: "/api/v1/inventory/movements",
      headers,
      payload: { itemId, direction: "out", quantity: 12, reason: "Oops" },
    });
    expect(tooMuch.statusCode).toBe(409);
    const outbound = await built.app.inject({
      method: "POST",
      url: "/api/v1/inventory/movements",
      headers,
      payload: { itemId, direction: "out", quantity: 6, reason: "Class use" },
    });
    expect(outbound.json().quantity).toBe(4);
    const list = await built.app.inject({ method: "GET", url: "/api/v1/inventory", headers });
    expect(list.json().items[0].lowStock).toBe(true);

    const csv = await built.app.inject({ method: "GET", url: "/api/v1/reports/pupils?format=csv", headers });
    expect(csv.statusCode).toBe(200);
    expect(String(csv.headers["content-type"])).toContain("text/csv");
    expect(csv.body).toContain("Amina");
    const pdf = await built.app.inject({ method: "GET", url: "/api/v1/reports/enrolment?format=pdf", headers });
    expect(pdf.statusCode).toBe(200);
    expect(String(pdf.headers["content-type"])).toContain("application/pdf");

    const teacher = await loginAs(built, headers, "tsearch", "TeacherPass1", "teacher");
    const teacherPayroll = await built.app.inject({
      method: "GET",
      url: "/api/v1/reports/payroll",
      headers: teacher,
    });
    expect(teacherPayroll.statusCode).toBe(403);
    const teacherStock = await built.app.inject({
      method: "POST",
      url: "/api/v1/inventory",
      headers: teacher,
      payload: {
        sku: "X",
        name: "X",
        category: "X",
        location: "X",
        condition: "good",
        acquiredOn: "2026-09-01",
        costFcfa: 1,
        minQty: 1,
      },
    });
    expect(teacherStock.statusCode).toBe(403);
    const teacherSearch = await built.app.inject({
      method: "GET",
      url: "/api/v1/search?q=Amina",
      headers: teacher,
    });
    expect(teacherSearch.statusCode).toBe(200);
    expect(teacherSearch.json().items.some((hit: { type: string }) => hit.type === "pupil")).toBe(true);
    expect(teacherSearch.json().items.some((hit: { type: string }) => hit.type === "receipt")).toBe(false);

    const adminSearch = await built.app.inject({ method: "GET", url: "/api/v1/search?q=Amina", headers });
    expect(adminSearch.json().items.length).toBeGreaterThan(0);

    const event = await built.app.inject({
      method: "POST",
      url: "/api/v1/calendar",
      headers,
      payload: { title: "Sports day", kind: "event", startDate: "2026-11-20", endDate: "2026-11-20" },
    });
    expect(event.statusCode).toBe(200);
    const note = await built.app.inject({
      method: "POST",
      url: "/api/v1/announcements",
      headers,
      payload: { title: "Welcome", body: "Term 1 starts", audience: "all" },
    });
    expect(note.statusCode).toBe(200);
    const template = await built.app.inject({
      method: "POST",
      url: "/api/v1/templates",
      headers,
      payload: {
        name: "Fee reminder",
        body: "Dear {{pupil.givenName}} at {{school.name}}",
      },
    });
    expect(template.statusCode).toBe(200);
    const pupils = await built.app.inject({ method: "GET", url: "/api/v1/pupils?q=Amina", headers });
    const pupilId = pupils.json().items[0].id as string;
    const rendered = await built.app.inject({
      method: "POST",
      url: `/api/v1/templates/${template.json().id as string}/render`,
      headers,
      payload: { pupilId },
    });
    expect(rendered.statusCode).toBe(200);
    expect(rendered.json().text).toContain("Amina");
    expect(rendered.json().text).toContain("ALL BRIGHT CHILDREN");

    const dash = await built.app.inject({ method: "GET", url: "/api/v1/dashboard", headers });
    expect(dash.statusCode).toBe(200);
    expect(dash.json().pupilCount).toBeGreaterThan(0);
    expect(dash.json().announcements.length).toBeGreaterThan(0);

    const teacherDash = await built.app.inject({ method: "GET", url: "/api/v1/dashboard", headers: teacher });
    expect(teacherDash.statusCode).toBe(200);
    expect(teacherDash.json().fees).toBeNull();
  });
});
