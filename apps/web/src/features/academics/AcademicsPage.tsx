import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useAuth } from "../../app/AuthProvider";
import { apiBlob, apiGet, apiSend } from "../../lib/api";

type Tree = {
  years: { id: string; terms: { id: string; name: string }[] }[];
  classes: { id: string; label: string }[];
};
type Offering = { id: string; classId: string; subjectId: string; coefficient: number };
type Subject = { id: string; name: string };
type TypeRow = { id: string; name: string; termId: string; maxScore: number; weight: number };
type Assessment = { id: string; typeId: string; classSubjectId: string; status: string };
type Pupil = { id: string; givenName: string; familyName: string; admissionNumber: string };
type RosterMark = { pupilId: string; score: number | null; status: string };
type Snapshot = {
  pupils: {
    pupilId: string;
    rank: number | null;
    termOnScale: number | null;
  }[];
  scoreOutOf: number;
  classSize: number;
};

export function AcademicsPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [classId, setClassId] = useState("");
  const [termId, setTermId] = useState("");
  const [classSubjectId, setClassSubjectId] = useState("");
  const [assessmentId, setAssessmentId] = useState("");
  const [draft, setDraft] = useState<Record<string, { score: string; status: string }>>({});

  const canMarks = user?.roleSlug === "super_admin" || user?.permissions.includes("academics:marks");
  const canUnlock = user?.roleSlug === "super_admin" || user?.permissions.includes("academics:unlock");

  const tree = useQuery({ queryKey: ["academic-tree"], queryFn: () => apiGet<Tree & { subjects: Subject[] }>("/api/v1/academic/tree") });
  const offerings = useQuery({
    queryKey: ["offerings", classId],
    queryFn: () => apiGet<{ items: Offering[] }>(`/api/v1/academics/offerings?classId=${encodeURIComponent(classId)}`),
    enabled: Boolean(classId),
  });
  const types = useQuery({
    queryKey: ["atypes", termId],
    queryFn: () => apiGet<{ items: TypeRow[] }>(`/api/v1/academics/types?termId=${encodeURIComponent(termId)}`),
    enabled: Boolean(termId),
  });
  const assessments = useQuery({
    queryKey: ["assessments", classSubjectId],
    queryFn: () =>
      apiGet<{ items: Assessment[] }>(
        `/api/v1/academics/assessments?classSubjectId=${encodeURIComponent(classSubjectId)}`,
      ),
    enabled: Boolean(classSubjectId),
  });
  const pupils = useQuery({
    queryKey: ["class-pupils", classId],
    queryFn: () => apiGet<{ items: Pupil[] }>(`/api/v1/pupils?classId=${encodeURIComponent(classId)}`),
    enabled: Boolean(classId),
  });
  const detail = useQuery({
    queryKey: ["assessment", assessmentId],
    queryFn: () => apiGet<{ assessment: Assessment; type: TypeRow; roster: RosterMark[] }>(`/api/v1/academics/assessments/${assessmentId}`),
    enabled: Boolean(assessmentId),
  });
  const results = useQuery({
    queryKey: ["results", classId, termId],
    queryFn: () =>
      apiGet<{ snapshot: Snapshot | null }>(
        `/api/v1/academics/results?classId=${encodeURIComponent(classId)}&termId=${encodeURIComponent(termId)}`,
      ),
    enabled: Boolean(classId && termId),
  });

  const subjects = tree.data?.subjects ?? [];
  const maxScore = detail.data?.type.maxScore ?? 20;
  const locked = detail.data?.assessment.status === "locked";

  const rows = useMemo(() => {
    const roster = pupils.data?.items ?? [];
    return roster.map((pupil) => {
      const existing = detail.data?.roster.find((row) => row.pupilId === pupil.id);
      const local = draft[pupil.id];
      return {
        pupil,
        score: local?.score ?? (existing?.score == null ? "" : String(existing.score)),
        status: local?.status ?? existing?.status ?? "present",
      };
    });
  }, [pupils.data, detail.data, draft]);

  const refresh = () => void queryClient.invalidateQueries();
  const fail = (err: unknown) => setError(err instanceof Error ? err.message : "Failed");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-deep">Academics</h1>
      <p className="text-sm text-muted">
        Marks 0–max, Tab through the grid, submit to lock. Unlocking needs Headteacher. Ranks use competition (min rank).
      </p>
      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <div className="flex flex-wrap gap-3 rounded-card border border-line bg-white p-5 shadow-card">
        <select
          className="rounded-lg border border-line px-3 py-2"
          value={classId}
          onChange={(e) => {
            setClassId(e.target.value);
            setClassSubjectId("");
            setAssessmentId("");
          }}
        >
          <option value="">Class</option>
          {(tree.data?.classes ?? []).map((cls) => (
            <option key={cls.id} value={cls.id}>
              {cls.label}
            </option>
          ))}
        </select>
        <select
          className="rounded-lg border border-line px-3 py-2"
          value={termId}
          onChange={(e) => setTermId(e.target.value)}
        >
          <option value="">Term</option>
          {(tree.data?.years[0]?.terms ?? []).map((term) => (
            <option key={term.id} value={term.id}>
              {term.name}
            </option>
          ))}
        </select>
        <select
          className="rounded-lg border border-line px-3 py-2"
          value={classSubjectId}
          onChange={(e) => {
            setClassSubjectId(e.target.value);
            setAssessmentId("");
          }}
        >
          <option value="">Subject</option>
          {(offerings.data?.items ?? []).map((row) => (
            <option key={row.id} value={row.id}>
              {subjects.find((s) => s.id === row.subjectId)?.name ?? row.subjectId} (coeff {row.coefficient})
            </option>
          ))}
        </select>
        <select
          className="rounded-lg border border-line px-3 py-2"
          value={assessmentId}
          onChange={(e) => {
            setAssessmentId(e.target.value);
            setDraft({});
          }}
        >
          <option value="">Assessment</option>
          {(assessments.data?.items ?? []).map((row) => {
            const typeName = types.data?.items.find((t) => t.id === row.typeId)?.name ?? row.typeId;
            return (
              <option key={row.id} value={row.id}>
                {typeName} ({row.status})
              </option>
            );
          })}
        </select>
      </div>

      {canUnlock ? (
        <form
          className="flex flex-wrap gap-3 rounded-card border border-line bg-white p-5 shadow-card"
          onSubmit={(e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            setError(null);
            void apiSend("/api/v1/academics/types", "POST", {
              name: form.get("name"),
              termId,
              weight: Number(form.get("weight")),
              maxScore: Number(form.get("maxScore")),
            })
              .then(refresh)
              .catch(fail);
          }}
        >
          <input className="rounded-lg border border-line px-3 py-2" name="name" placeholder="Assessment type" required disabled={!termId} />
          <input className="w-24 rounded-lg border border-line px-3 py-2" name="weight" type="number" defaultValue={1} min={1} />
          <input className="w-24 rounded-lg border border-line px-3 py-2" name="maxScore" type="number" defaultValue={20} min={1} />
          <button className="rounded-lg bg-purple px-4 py-2 text-white" type="submit" disabled={!termId}>
            Add type
          </button>
        </form>
      ) : null}

      {canMarks ? (
        <div className="flex flex-wrap gap-3">
          <button
            className="rounded-lg border border-line bg-white px-4 py-2"
            type="button"
            disabled={!classSubjectId || !types.data?.items[0]}
            onClick={() => {
              const typeId = types.data?.items[0]?.id;
              if (!typeId) return;
              setError(null);
              void apiSend<{ id: string }>("/api/v1/academics/assessments", "POST", { typeId, classSubjectId })
                .then((created) => {
                  setAssessmentId(created.id);
                  refresh();
                })
                .catch(fail);
            }}
          >
            Open first type as assessment
          </button>
        </div>
      ) : null}

      {assessmentId ? (
        <div className="overflow-x-auto rounded-card border border-line bg-white shadow-card">
          <table className="min-w-full text-sm">
            <thead className="bg-pale text-left">
              <tr>
                <th className="px-4 py-2">Pupil</th>
                <th className="px-4 py-2">Score (0–{maxScore})</th>
                <th className="px-4 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.pupil.id} className="border-t border-line">
                  <td className="px-4 py-2">
                    {row.pupil.givenName} {row.pupil.familyName}
                  </td>
                  <td className="px-4 py-2">
                    <input
                      className="w-24 rounded-lg border border-line px-2 py-1"
                      type="number"
                      min={0}
                      max={maxScore}
                      disabled={locked || !canMarks}
                      value={row.score}
                      onChange={(e) =>
                        setDraft((prev) => ({
                          ...prev,
                          [row.pupil.id]: { score: e.target.value, status: row.status },
                        }))
                      }
                    />
                  </td>
                  <td className="px-4 py-2">
                    <select
                      className="rounded-lg border border-line px-2 py-1"
                      disabled={locked || !canMarks}
                      value={row.status}
                      onChange={(e) =>
                        setDraft((prev) => ({
                          ...prev,
                          [row.pupil.id]: { score: row.score, status: e.target.value },
                        }))
                      }
                    >
                      <option value="present">Present</option>
                      <option value="absent">Absent</option>
                      <option value="excused">Excused</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex flex-wrap gap-3 p-4">
            <button
              className="rounded-lg bg-purple px-4 py-2 text-white"
              type="button"
              disabled={locked || !canMarks}
              onClick={() => {
                setError(null);
                void apiSend("/api/v1/academics/marks", "POST", {
                  assessmentId,
                  marks: rows.map((row) => ({
                    pupilId: row.pupil.id,
                    score: row.status === "present" && row.score !== "" ? Number(row.score) : null,
                    status: row.status,
                  })),
                })
                  .then(refresh)
                  .catch(fail);
              }}
            >
              Save draft
            </button>
            <button
              className="rounded-lg border border-line px-4 py-2"
              type="button"
              disabled={locked || !canMarks}
              onClick={() => {
                setError(null);
                void apiSend(`/api/v1/academics/assessments/${assessmentId}/submit`, "POST")
                  .then(refresh)
                  .catch(fail);
              }}
            >
              Submit and lock
            </button>
            {canUnlock ? (
              <button
                className="rounded-lg border border-line px-4 py-2"
                type="button"
                disabled={!locked}
                onClick={() => {
                  setError(null);
                  void apiSend(`/api/v1/academics/assessments/${assessmentId}/unlock`, "POST")
                    .then(refresh)
                    .catch(fail);
                }}
              >
                Unlock
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {classId && termId ? (
        <div className="rounded-card border border-line bg-white p-5 shadow-card">
          {canUnlock ? (
            <button
              className="rounded-lg bg-purple px-4 py-2 text-white"
              type="button"
              onClick={() => {
                setError(null);
                void apiSend("/api/v1/academics/compute", "POST", { classId, termId })
                  .then(refresh)
                  .catch(fail);
              }}
            >
              Compute term results
            </button>
          ) : null}
          <ul className="mt-4 space-y-2 text-sm">
            {(results.data?.snapshot?.pupils ?? []).map((row) => {
              const pupil = pupils.data?.items.find((p) => p.id === row.pupilId);
              return (
                <li key={row.pupilId} className="flex items-center justify-between gap-3">
                  <span>
                    {pupil ? `${pupil.givenName} ${pupil.familyName}` : row.pupilId} — {row.termOnScale ?? "—"} /{" "}
                    {results.data?.snapshot?.scoreOutOf} rank {row.rank ?? "—"}
                  </span>
                  <button
                    className="rounded-lg border border-line px-3 py-1"
                    type="button"
                    onClick={() => {
                      void apiBlob(`/api/v1/report-cards/${row.pupilId}/${termId}/pdf`)
                        .then((blob) => {
                          const url = URL.createObjectURL(blob);
                          window.open(url, "_blank", "noopener");
                        })
                        .catch(fail);
                    }}
                  >
                    Report card PDF
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
