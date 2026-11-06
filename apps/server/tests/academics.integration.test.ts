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
  return {
    headers: { cookie: cookies, [CSRF_HEADER]: csrf2.json().csrfToken as string } as Headers,
    userId: created.json().id as string,
  };
}

async function classAndPupils(built: Awaited<ReturnType<typeof startTestApp>>, headers: Headers) {
  const tree = await built.app.inject({ method: "GET", url: "/api/v1/academic/tree", headers });
  const body = tree.json() as {
    years: { id: string; terms: { id: string; name: string }[] }[];
    sections: { name: string; levels: { id: string; name: string }[] }[];
  };
  const form1 = body.sections.flatMap((s) => s.levels).find((l) => l.name === "Form 1");
  const created = await built.app.inject({
    method: "POST",
    url: "/api/v1/academic/classes",
    headers,
    payload: { academicYearId: body.years[0]?.id, levelId: form1!.id, stream: "A", capacity: 40 },
  });
  expect(created.statusCode).toBe(200);
  const classId = created.json().id as string;
  const imported = await built.app.inject({
    method: "POST",
    url: "/api/v1/pupils/import",
    headers,
    payload: {
      dryRun: false,
      rows: [
        {
          givenName: "Amina",
          familyName: "One",
          sex: "F",
          dob: "2014-01-01",
          classStream: "Form 1 A",
          guardianGivenName: "Paul",
          guardianFamilyName: "One",
          guardianPhone: "677000001",
        },
        {
          givenName: "Jean",
          familyName: "Two",
          sex: "M",
          dob: "2014-02-02",
          classStream: "Form 1 A",
          guardianGivenName: "Marie",
          guardianFamilyName: "Two",
          guardianPhone: "677000002",
        },
        {
          givenName: "Lisa",
          familyName: "Three",
          sex: "F",
          dob: "2014-03-03",
          classStream: "Form 1 A",
          guardianGivenName: "Rita",
          guardianFamilyName: "Three",
          guardianPhone: "677000003",
        },
      ],
    },
  });
  expect(imported.statusCode).toBe(200);
  const roster = await built.app.inject({
    method: "GET",
    url: `/api/v1/pupils?classId=${classId}`,
    headers,
  });
  const pupils = roster.json().items as { id: string }[];
  expect(pupils).toHaveLength(3);
  const subject = await built.app.inject({
    method: "POST",
    url: "/api/v1/academic/subjects",
    headers,
    payload: { code: "ENG", name: "English" },
  });
  expect(subject.statusCode).toBe(200);
  const offering = await built.app.inject({
    method: "POST",
    url: "/api/v1/academic/class-subjects",
    headers,
    payload: { classId, subjectId: subject.json().id, coefficient: 2 },
  });
  expect(offering.statusCode).toBe(200);
  const grading = await built.app.inject({ method: "GET", url: "/api/v1/academic/grading", headers });
  expect(grading.statusCode).toBe(200);
  const termId = body.years[0]!.terms[0]!.id;
  return {
    classId,
    yearId: body.years[0]!.id,
    termId,
    classSubjectId: offering.json().id as string,
    pupilIds: pupils.map((p) => p.id),
  };
}

describe("academics and attendance", () => {
  it("locks marks, ranks ties with min rank, and scopes teachers", async () => {
    const { built, headers } = await ready();
    const ctx = await classAndPupils(built, headers);

    const type = await built.app.inject({
      method: "POST",
      url: "/api/v1/academics/types",
      headers,
      payload: { name: "Sequence 1", termId: ctx.termId, weight: 1, maxScore: 20 },
    });
    expect(type.statusCode).toBe(200);

    const teacher = await loginAs(built, headers, "teach1", "TeacherPass1", "teacher");
    const staffRow = await built.app.inject({
      method: "POST",
      url: "/api/v1/staff",
      headers,
      payload: {
        givenName: "Ada",
        familyName: "Teacher",
        sex: "F",
        phone: "670222333",
        position: "Teacher",
        hireDate: "2024-09-01",
        userId: teacher.userId,
      },
    });
    expect(staffRow.statusCode).toBe(200);
    const assignment = await built.app.inject({
      method: "POST",
      url: "/api/v1/staff/assignments",
      headers,
      payload: {
        staffId: staffRow.json().id,
        academicYearId: ctx.yearId,
        role: "subject_teacher",
        classSubjectId: ctx.classSubjectId,
      },
    });
    expect(assignment.statusCode).toBe(200);

    const outsider = await loginAs(built, headers, "teach2", "TeacherPass2", "teacher");
    const denied = await built.app.inject({
      method: "POST",
      url: "/api/v1/academics/assessments",
      headers: outsider.headers,
      payload: { typeId: type.json().id, classSubjectId: ctx.classSubjectId },
    });
    expect(denied.statusCode).toBe(403);

    const assessment = await built.app.inject({
      method: "POST",
      url: "/api/v1/academics/assessments",
      headers: teacher.headers,
      payload: { typeId: type.json().id, classSubjectId: ctx.classSubjectId },
    });
    expect(assessment.statusCode).toBe(200);
    const assessmentId = assessment.json().id as string;

    const save = await built.app.inject({
      method: "POST",
      url: "/api/v1/academics/marks",
      headers: teacher.headers,
      payload: {
        assessmentId,
        marks: [
          { pupilId: ctx.pupilIds[0], score: 16, status: "present" },
          { pupilId: ctx.pupilIds[1], score: 16, status: "present" },
          { pupilId: ctx.pupilIds[2], score: 10, status: "present" },
        ],
      },
    });
    expect(save.statusCode).toBe(200);

    const submit = await built.app.inject({
      method: "POST",
      url: `/api/v1/academics/assessments/${assessmentId}/submit`,
      headers: teacher.headers,
    });
    expect(submit.statusCode).toBe(200);

    const locked = await built.app.inject({
      method: "POST",
      url: "/api/v1/academics/marks",
      headers: teacher.headers,
      payload: {
        assessmentId,
        marks: [{ pupilId: ctx.pupilIds[0], score: 18, status: "present" }],
      },
    });
    expect(locked.statusCode).toBe(409);

    const teacherUnlock = await built.app.inject({
      method: "POST",
      url: `/api/v1/academics/assessments/${assessmentId}/unlock`,
      headers: teacher.headers,
    });
    expect(teacherUnlock.statusCode).toBe(403);

    const unlock = await built.app.inject({
      method: "POST",
      url: `/api/v1/academics/assessments/${assessmentId}/unlock`,
      headers,
    });
    expect(unlock.statusCode).toBe(200);

    const compute = await built.app.inject({
      method: "POST",
      url: "/api/v1/academics/compute",
      headers,
      payload: { classId: ctx.classId, termId: ctx.termId },
    });
    expect(compute.statusCode).toBe(200);
    const snapshot = compute.json() as {
      pupils: { pupilId: string; rank: number | null }[];
    };
    const ranks = snapshot.pupils
      .slice()
      .sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99))
      .map((p) => p.rank);
    expect(ranks).toEqual([1, 1, 3]);

    const pdf = await built.app.inject({
      method: "GET",
      url: `/api/v1/report-cards/${ctx.pupilIds[0]}/${ctx.termId}/pdf`,
      headers,
    });
    expect(pdf.statusCode).toBe(200);
    expect(String(pdf.headers["content-type"])).toContain("application/pdf");

    const attendance = await built.app.inject({
      method: "POST",
      url: "/api/v1/attendance",
      headers: teacher.headers,
      payload: {
        classId: ctx.classId,
        day: "2026-09-15",
        entries: ctx.pupilIds.map((pupilId, index) => ({
          pupilId,
          mark: index === 2 ? "absent" : "present",
        })),
      },
    });
    expect(attendance.statusCode).toBe(200);

    const outsiderAttend = await built.app.inject({
      method: "POST",
      url: "/api/v1/attendance",
      headers: outsider.headers,
      payload: {
        classId: ctx.classId,
        day: "2026-09-16",
        entries: [{ pupilId: ctx.pupilIds[0], mark: "present" }],
      },
    });
    expect(outsiderAttend.statusCode).toBe(403);

    const register = await built.app.inject({
      method: "GET",
      url: `/api/v1/attendance?classId=${ctx.classId}&day=2026-09-15`,
      headers: teacher.headers,
    });
    expect(register.statusCode).toBe(200);
    expect(register.json().items).toHaveLength(3);
  });
});
