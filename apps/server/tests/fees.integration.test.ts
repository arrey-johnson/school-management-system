import { CSRF_HEADER, IDEMPOTENCY_HEADER } from "@sms/shared";
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
  const tree = await built.app.inject({ method: "GET", url: "/api/v1/academic/tree", headers });
  const body = tree.json() as {
    years: { id: string }[];
    sections: { levels: { id: string; name: string }[] }[];
  };
  const form1 = body.sections.flatMap((s) => s.levels).find((l) => l.name === "Form 1");
  const cls = await built.app.inject({
    method: "POST",
    url: "/api/v1/academic/classes",
    headers,
    payload: { academicYearId: body.years[0]?.id, levelId: form1?.id, stream: "A", capacity: 40 },
  });
  expect(cls.statusCode).toBe(200);
  const item = await built.app.inject({
    method: "POST",
    url: "/api/v1/fees/items",
    headers,
    payload: {
      code: "TUI",
      name: "Tuition",
      amountFcfa: 50_000,
      mandatory: true,
      scope: "year",
      academicYearId: body.years[0]?.id,
    },
  });
  expect(item.statusCode).toBe(200);
  const pupil = await built.app.inject({
    method: "POST",
    url: "/api/v1/pupils",
    headers,
    payload: {
      givenName: "Amina",
      familyName: "Ngono",
      sex: "F",
      dob: "2014-03-12",
      classId: cls.json().id,
      guardian: {
        givenName: "Paul",
        familyName: "Ngono",
        phone: "677111222",
        relationship: "Father",
        primaryContact: true,
        feePayer: true,
      },
    },
  });
  expect(pupil.statusCode).toBe(200);
  return { built, headers, pupilId: pupil.json().id as string, yearId: body.years[0]!.id };
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

describe("fees and payments", () => {
  it("invoices on enrol, allocates oldest-first, and issues RC-00001", async () => {
    const { built, headers, pupilId } = await ready();
    const invoices = await built.app.inject({
      method: "GET",
      url: `/api/v1/fees/invoices?pupilId=${pupilId}`,
      headers,
    });
    expect(invoices.json().items[0].account.status).toBe("unpaid");
    expect(invoices.json().items[0].account.balanceFcfa).toBe(50_000);

    const pay = await built.app.inject({
      method: "POST",
      url: "/api/v1/payments",
      headers: { ...headers, [IDEMPOTENCY_HEADER]: "pay-1" },
      payload: {
        pupilId,
        amountFcfa: 20_000,
        channel: "cash",
        entryDate: "2026-11-06",
        payerName: "Paul Ngono",
      },
    });
    expect(pay.statusCode).toBe(200);
    expect(pay.json().receiptNumber).toBe("RC-00001");

    const replay = await built.app.inject({
      method: "POST",
      url: "/api/v1/payments",
      headers: { ...headers, [IDEMPOTENCY_HEADER]: "pay-1" },
      payload: {
        pupilId,
        amountFcfa: 20_000,
        channel: "cash",
        entryDate: "2026-11-06",
        payerName: "Paul Ngono",
      },
    });
    expect(replay.json().replayed).toBe(true);
    expect(replay.json().receiptNumber).toBe("RC-00001");

    const second = await built.app.inject({
      method: "POST",
      url: "/api/v1/payments",
      headers,
      payload: {
        pupilId,
        amountFcfa: 30_000,
        channel: "mtn_momo",
        entryDate: "2026-11-07",
        payerName: "Paul Ngono",
      },
    });
    expect(second.json().receiptNumber).toBe("RC-00002");

    const after = await built.app.inject({
      method: "GET",
      url: `/api/v1/fees/invoices?pupilId=${pupilId}`,
      headers,
    });
    expect(after.json().items[0].account.status).toBe("paid");
    expect(after.json().items[0].account.balanceFcfa).toBe(0);

    const pdf = await built.app.inject({
      method: "GET",
      url: `/api/v1/receipts/${pay.json().receiptId as string}/pdf`,
      headers,
    });
    expect(pdf.statusCode).toBe(200);
    expect(pdf.headers["content-type"]).toContain("application/pdf");
  });

  it("requires a second user to approve a reversal", async () => {
    const { built, headers, pupilId } = await ready();
    const bursar = await loginAs(built, headers, "bursar1", "BursarPass1", "bursar");
    const pay = await built.app.inject({
      method: "POST",
      url: "/api/v1/payments",
      headers: bursar,
      payload: {
        pupilId,
        amountFcfa: 10_000,
        channel: "cash",
        entryDate: "2026-11-06",
        payerName: "Paul Ngono",
      },
    });
    expect(pay.statusCode).toBe(200);
    const reverse = await built.app.inject({
      method: "POST",
      url: `/api/v1/payments/${pay.json().paymentId as string}/reverse`,
      headers: bursar,
      payload: { reason: "Entered on the wrong pupil" },
    });
    expect(reverse.statusCode).toBe(200);
    const self = await built.app.inject({
      method: "POST",
      url: `/api/v1/approvals/${reverse.json().approvalId as string}/decide`,
      headers: bursar,
      payload: { decision: "approved" },
    });
    expect(self.statusCode).toBe(403);
    const decided = await built.app.inject({
      method: "POST",
      url: `/api/v1/approvals/${reverse.json().approvalId as string}/decide`,
      headers,
      payload: { decision: "approved" },
    });
    expect(decided.statusCode).toBe(200);
    const account = await built.app.inject({
      method: "GET",
      url: `/api/v1/fees/invoices?pupilId=${pupilId}`,
      headers,
    });
    expect(account.json().items[0].account.balanceFcfa).toBe(50_000);
  });

  it("holds large discounts for approval and denies teachers", async () => {
    const { built, headers, pupilId } = await ready();
    const invoice = await built.app.inject({
      method: "GET",
      url: `/api/v1/fees/invoices?pupilId=${pupilId}`,
      headers,
    });
    const detail = await built.app.inject({
      method: "GET",
      url: `/api/v1/fees/invoices/${invoice.json().items[0].id as string}`,
      headers,
    });
    const lineId = detail.json().lines[0].id as string;
    const small = await built.app.inject({
      method: "POST",
      url: "/api/v1/fees/adjustments",
      headers,
      payload: { invoiceLineId: lineId, type: "discount", amountFcfa: 5_000, reason: "Sibling" },
    });
    expect(small.json().status).toBe("applied");
    const large = await built.app.inject({
      method: "POST",
      url: "/api/v1/fees/adjustments",
      headers,
      payload: { invoiceLineId: lineId, type: "discount", amountFcfa: 15_000, reason: "Scholarship" },
    });
    expect(large.json().status).toBe("pending");

    const teacher = await loginAs(built, headers, "teacher1", "TeacherPass1", "teacher");
    const denied = await built.app.inject({
      method: "POST",
      url: "/api/v1/payments",
      headers: teacher,
      payload: {
        pupilId,
        amountFcfa: 1_000,
        channel: "cash",
        entryDate: "2026-11-06",
        payerName: "X",
      },
    });
    expect(denied.statusCode).toBe(403);
  });
});
