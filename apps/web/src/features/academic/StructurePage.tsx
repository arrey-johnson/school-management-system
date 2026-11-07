import type { SchoolKind } from "@sms/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useAuth } from "../../app/AuthProvider";
import { SchoolKindFields } from "../../components/SchoolKindFields";
import { apiGet, apiSend } from "../../lib/api";

type SchoolProfile = {
  id: string;
  name: string;
  schoolKind: SchoolKind;
  motto: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
};

type Level = { id: string; name: string };
type Section = { id: string; name: string; levels: Level[] };
type Year = { id: string; name: string; isActive: boolean; terms: { id: string; name: string }[] };
type ClassRow = {
  id: string;
  label: string;
  capacity: number;
  levelName: string;
  sectionName: string;
  academicYearId: string;
  levelId: string;
};
type Subject = { id: string; code: string; name: string };
type Tree = { years: Year[]; sections: Section[]; classes: ClassRow[]; subjects: Subject[] };
type Grading = {
  scales: {
    id: string;
    scoreOutOf: number;
    passMark: number;
    sectionId: string;
    bands: { letter: string; minScore: number; maxScore: number; remark: string }[];
  }[];
};

export function StructurePage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const canEditSchool = user?.roleSlug === "super_admin" || user?.permissions.includes("school:update");
  const tree = useQuery({ queryKey: ["academic-tree"], queryFn: () => apiGet<Tree>("/api/v1/academic/tree") });
  const grading = useQuery({ queryKey: ["grading"], queryFn: () => apiGet<Grading>("/api/v1/academic/grading") });
  const school = useQuery({
    queryKey: ["school-profile"],
    queryFn: () => apiGet<{ school: SchoolProfile | null }>("/api/v1/school"),
  });
  const [error, setError] = useState<string | null>(null);
  const [schoolKind, setSchoolKind] = useState<SchoolKind | "">("");
  const [levelId, setLevelId] = useState("");
  const [stream, setStream] = useState("A");
  const [code, setCode] = useState("");
  const [subjectName, setSubjectName] = useState("");

  useEffect(() => {
    const kind = school.data?.school?.schoolKind;
    if (kind) setSchoolKind(kind);
  }, [school.data?.school?.schoolKind]);

  const year = tree.data?.years.find((y) => y.isActive) ?? tree.data?.years[0];
  const levels = tree.data?.sections.flatMap((s) => s.levels) ?? [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-deep">School structure</h1>
      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-card border border-line bg-white p-5 shadow-card">
          <h2 className="font-semibold">Years and terms</h2>
          {tree.data?.years.map((y) => (
            <div key={y.id} className="mt-3">
              <p>
                {y.name} {y.isActive ? <span className="text-success">(active)</span> : null}
              </p>
              <p className="text-sm text-muted">{y.terms.map((t) => t.name).join(" · ")}</p>
            </div>
          ))}
        </article>
        <article className="rounded-card border border-line bg-white p-5 shadow-card">
          <h2 className="font-semibold">Sections and levels</h2>
          {tree.data?.sections.map((section) => (
            <div key={section.id} className="mt-3">
              <p className="font-medium">{section.name}</p>
              <p className="text-sm text-muted">{section.levels.map((l) => l.name).join(", ")}</p>
            </div>
          ))}
        </article>
      </div>

      <article className="rounded-card border border-line bg-white p-5 shadow-card">
        <h2 className="font-semibold">Classes</h2>
        <form
          className="mt-3 flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!year) return;
            setError(null);
            void apiSend("/api/v1/academic/classes", "POST", {
              academicYearId: year.id,
              levelId,
              stream,
              capacity: 40,
            })
              .then(() => {
                setStream("A");
                return queryClient.invalidateQueries({ queryKey: ["academic-tree"] });
              })
              .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed"));
          }}
        >
          <label className="text-sm">
            Level
            <select
              className="mt-1 block rounded-lg border border-line px-3 py-2"
              value={levelId}
              onChange={(e) => setLevelId(e.target.value)}
              required
            >
              <option value="">Select</option>
              {levels.map((level) => (
                <option key={level.id} value={level.id}>
                  {level.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Stream
            <input
              className="mt-1 block rounded-lg border border-line px-3 py-2"
              value={stream}
              onChange={(e) => setStream(e.target.value)}
            />
          </label>
          <button className="rounded-lg bg-purple px-4 py-2 text-white" type="submit">
            Add class
          </button>
        </form>
        <table className="mt-4 w-full text-left text-sm">
          <thead className="text-muted">
            <tr>
              <th className="py-2">Class</th>
              <th>Section</th>
              <th>Capacity</th>
            </tr>
          </thead>
          <tbody>
            {tree.data?.classes.map((cls) => (
              <tr key={cls.id} className="border-t border-line">
                <td className="py-2">{cls.label}</td>
                <td>{cls.sectionName}</td>
                <td>{cls.capacity}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </article>

      <article className="rounded-card border border-line bg-white p-5 shadow-card">
        <h2 className="font-semibold">Subjects</h2>
        <form
          className="mt-3 flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            void apiSend("/api/v1/academic/subjects", "POST", { code, name: subjectName })
              .then(() => {
                setCode("");
                setSubjectName("");
                return queryClient.invalidateQueries({ queryKey: ["academic-tree"] });
              })
              .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed"));
          }}
        >
          <input
            className="rounded-lg border border-line px-3 py-2"
            placeholder="Code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
          />
          <input
            className="rounded-lg border border-line px-3 py-2"
            placeholder="Name"
            value={subjectName}
            onChange={(e) => setSubjectName(e.target.value)}
            required
          />
          <button className="rounded-lg bg-purple px-4 py-2 text-white" type="submit">
            Add subject
          </button>
        </form>
        <ul className="mt-3 text-sm">
          {tree.data?.subjects.map((s) => (
            <li key={s.id}>
              {s.code} — {s.name}
            </li>
          ))}
        </ul>
      </article>

      <article className="rounded-card border border-line bg-white p-5 shadow-card">
        <h2 className="font-semibold">Grading defaults</h2>
        <p className="mt-1 text-sm text-muted">Primary /100, Secondary /20.</p>
        {grading.data?.scales.map((scale) => (
          <div key={scale.id} className="mt-3 text-sm">
            <p>
              Out of {scale.scoreOutOf}, pass {scale.passMark}
            </p>
            <p className="text-muted">
              {scale.bands.map((b) => `${b.letter} ${b.minScore}–${b.maxScore}`).join(" · ")}
            </p>
          </div>
        ))}
      </article>

      <article className="rounded-card border border-line bg-white px-4 py-3 shadow-card">
        <form
          className="flex flex-wrap items-center gap-x-4 gap-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            const profile = school.data?.school;
            if (!profile || !schoolKind) return;
            setError(null);
            void apiSend("/api/v1/school", "PATCH", {
              name: profile.name,
              schoolKind,
              motto: profile.motto ?? "",
              address: profile.address ?? "",
              phone: profile.phone ?? "",
              email: profile.email ?? "",
            })
              .then(() =>
                Promise.all([
                  queryClient.invalidateQueries({ queryKey: ["academic-tree"] }),
                  queryClient.invalidateQueries({ queryKey: ["school-profile"] }),
                  queryClient.invalidateQueries({ queryKey: ["branding"] }),
                ]),
              )
              .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed"));
          }}
        >
          <span className="text-sm font-medium text-deep">School type</span>
          <SchoolKindFields compact value={schoolKind} onChange={setSchoolKind} disabled={!canEditSchool} />
          {canEditSchool ? (
            <button className="rounded-lg bg-purple px-3 py-1.5 text-sm text-white" type="submit">
              Save
            </button>
          ) : (
            <span className="text-sm text-muted">Ask an administrator to change this.</span>
          )}
        </form>
      </article>
    </div>
  );
}
