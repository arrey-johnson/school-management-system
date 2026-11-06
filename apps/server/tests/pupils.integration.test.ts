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

async function sessionApp() {
  const built = await startTestApp();
  apps.push(built);
  const session = await bootstrapAndLogin(built.app);
  await completeWizard(built.app, session.cookies, session.csrf);
  const headers: Headers = { cookie: session.cookies, [CSRF_HEADER]: session.csrf };
  return { built, headers };
}

async function createClass(built: Awaited<ReturnType<typeof startTestApp>>, headers: Headers, stream = "A") {
  const tree = await built.app.inject({ method: "GET", url: "/api/v1/academic/tree", headers });
  const body = tree.json() as {
    years: { id: string }[];
    sections: { name: string; levels: { id: string; name: string }[] }[];
  };
  const form1 = body.sections.flatMap((s) => s.levels).find((l) => l.name === "Form 1");
  const nursery1 = body.sections.flatMap((s) => s.levels).find((l) => l.name === "Nursery 1");
  expect(form1).toBeTruthy();
  const created = await built.app.inject({
    method: "POST",
    url: "/api/v1/academic/classes",
    headers,
    payload: {
      academicYearId: body.years[0]?.id,
      levelId: form1!.id,
      stream,
      capacity: 40,
    },
  });
  expect(created.statusCode).toBe(200);
  return {
    classId: created.json().id as string,
    yearId: body.years[0]!.id,
    form1Id: form1!.id,
    nursery1Id: nursery1!.id,
  };
}

describe("admissions, pupils, import, promote", () => {
  it("admits, enrols with ABC-2026-0001, and searches by name and phone", async () => {
    const { built, headers } = await sessionApp();
    const { classId, form1Id } = await createClass(built, headers);

    const applied = await built.app.inject({
      method: "POST",
      url: "/api/v1/applications",
      headers,
      payload: {
        givenName: "Amina",
        familyName: "Ngono",
        sex: "F",
        dob: "2014-03-12",
        levelId: form1Id,
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
    expect(applied.statusCode).toBe(200);
    const applicationId = applied.json().id as string;

    const review = await built.app.inject({
      method: "POST",
      url: `/api/v1/applications/${applicationId}/status`,
      headers,
      payload: { status: "under_review" },
    });
    expect(review.statusCode).toBe(200);

    const accept = await built.app.inject({
      method: "POST",
      url: `/api/v1/applications/${applicationId}/status`,
      headers,
      payload: { status: "accepted" },
    });
    expect(accept.statusCode).toBe(200);

    const enrol = await built.app.inject({
      method: "POST",
      url: `/api/v1/applications/${applicationId}/enrol`,
      headers,
      payload: { classId },
    });
    expect(enrol.statusCode).toBe(200);
    expect(enrol.json().admissionNumber).toBe("ABC-2026-0001");

    const byName = await built.app.inject({
      method: "GET",
      url: "/api/v1/pupils?q=Amina",
      headers,
    });
    expect(byName.json().items).toHaveLength(1);

    const byPhone = await built.app.inject({
      method: "GET",
      url: "/api/v1/pupils?q=677111222",
      headers,
    });
    expect(byPhone.json().items).toHaveLength(1);

    const detail = await built.app.inject({
      method: "GET",
      url: `/api/v1/pupils/${enrol.json().id as string}`,
      headers,
    });
    expect(detail.statusCode).toBe(200);
    expect(detail.json().timeline.length).toBeGreaterThan(0);
    expect(detail.json().guardians[0].phone).toBe("677111222");
  });

  it("dry-runs import then commits rows into a known class", async () => {
    const { built, headers } = await sessionApp();
    await createClass(built, headers, "A");

    const dryUnknown = await built.app.inject({
      method: "POST",
      url: "/api/v1/pupils/import",
      headers,
      payload: {
        dryRun: true,
        rows: [
          {
            givenName: "Jean",
            familyName: "Mba",
            sex: "M",
            dob: "2015-01-01",
            classStream: "Form 9 Z",
            guardianGivenName: "Marie",
            guardianFamilyName: "Mba",
            guardianPhone: "677000111",
            relationship: "Mother",
          },
        ],
      },
    });
    expect(dryUnknown.statusCode).toBe(200);
    expect(dryUnknown.json().valid).toBe(false);

    const row = {
      givenName: "Jean",
      familyName: "Mba",
      sex: "M",
      dob: "2015-01-01",
      classStream: "Form 1 A",
      guardianGivenName: "Marie",
      guardianFamilyName: "Mba",
      guardianPhone: "677000111",
      relationship: "Mother",
    };
    const dryOk = await built.app.inject({
      method: "POST",
      url: "/api/v1/pupils/import",
      headers,
      payload: { dryRun: true, rows: [row] },
    });
    expect(dryOk.json().valid).toBe(true);

    const commit = await built.app.inject({
      method: "POST",
      url: "/api/v1/pupils/import",
      headers,
      payload: { dryRun: false, rows: [row] },
    });
    expect(commit.statusCode).toBe(200);
    expect(commit.json().created).toBe(1);
    expect(commit.json().numbers[0]).toMatch(/^ABC-2026-/);
  });

  it("promotes a pupil and undoes within 48 hours", async () => {
    const { built, headers } = await sessionApp();
    const source = await createClass(built, headers, "A");
    const target = await built.app.inject({
      method: "POST",
      url: "/api/v1/academic/classes",
      headers,
      payload: {
        academicYearId: source.yearId,
        levelId: source.form1Id,
        stream: "B",
        capacity: 40,
      },
    });
    expect(target.statusCode).toBe(200);
    const targetId = target.json().id as string;

    const pupil = await built.app.inject({
      method: "POST",
      url: "/api/v1/pupils",
      headers,
      payload: {
        givenName: "Eric",
        familyName: "Tabe",
        sex: "M",
        dob: "2013-05-05",
        classId: source.classId,
        guardian: {
          givenName: "Helen",
          familyName: "Tabe",
          phone: "670555444",
          relationship: "Mother",
          primaryContact: true,
          feePayer: true,
        },
      },
    });
    expect(pupil.statusCode).toBe(200);
    const pupilId = pupil.json().id as string;

    const promote = await built.app.inject({
      method: "POST",
      url: "/api/v1/enrolments/promote",
      headers,
      payload: {
        sourceClassId: source.classId,
        targetClassId: targetId,
        pupilIds: [pupilId],
      },
    });
    expect(promote.statusCode).toBe(200);
    const after = await built.app.inject({ method: "GET", url: `/api/v1/pupils/${pupilId}`, headers });
    expect(JSON.stringify(after.json().timeline)).toContain("Form 1 B");

    const undo = await built.app.inject({
      method: "POST",
      url: `/api/v1/enrolments/promote/${promote.json().batchId as string}/undo`,
      headers,
    });
    expect(undo.statusCode).toBe(200);
    const restored = await built.app.inject({ method: "GET", url: `/api/v1/pupils/${pupilId}`, headers });
    expect(JSON.stringify(restored.json().timeline[0])).toContain("Form 1 A");
  });

  it("rejects teacher creating an application", async () => {
    const { built, headers } = await sessionApp();
    const createTeacher = await built.app.inject({
      method: "POST",
      url: "/api/v1/users",
      headers,
      payload: {
        username: "teacher1",
        password: "TeacherPass1",
        displayName: "Mary Teacher",
        roleSlug: "teacher",
      },
    });
    expect(createTeacher.statusCode).toBe(200);

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
    const csrf2 = await built.app.inject({ method: "GET", url: "/api/v1/auth/csrf" });
    const teacherCookies = mergeCookies(
      Array.isArray(cookie) ? cookie.join("; ") : String(cookie ?? ""),
      Array.isArray(login.headers["set-cookie"])
        ? login.headers["set-cookie"].join("; ")
        : String(login.headers["set-cookie"] ?? ""),
      Array.isArray(csrf2.headers["set-cookie"])
        ? csrf2.headers["set-cookie"].join("; ")
        : String(csrf2.headers["set-cookie"] ?? ""),
    );
    const denied = await built.app.inject({
      method: "POST",
      url: "/api/v1/applications",
      headers: { cookie: teacherCookies, [CSRF_HEADER]: csrf2.json().csrfToken as string },
      payload: {
        givenName: "Amina",
        familyName: "Ngono",
        sex: "F",
        dob: "2014-03-12",
        levelId: "x",
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
    expect(denied.statusCode).toBe(403);
  });
});
