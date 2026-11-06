import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useAuth } from "../../app/AuthProvider";
import { apiGet, apiSend } from "../../lib/api";

type Tree = { classes: { id: string; label: string }[] };
type Pupil = { id: string; givenName: string; familyName: string };
type Register = { items: { pupilId: string; mark: string | null; reason: string | null }[] };

export function AttendancePage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [classId, setClassId] = useState("");
  const [day, setDay] = useState(() => new Date().toISOString().slice(0, 10));
  const [marks, setMarks] = useState<Record<string, { mark: string; reason: string }>>({});
  const canSubmit = user?.roleSlug === "super_admin" || user?.permissions.includes("attendance:submit");

  const tree = useQuery({ queryKey: ["academic-tree"], queryFn: () => apiGet<Tree>("/api/v1/academic/tree") });
  const pupils = useQuery({
    queryKey: ["class-pupils", classId],
    queryFn: () => apiGet<{ items: Pupil[] }>(`/api/v1/pupils?classId=${encodeURIComponent(classId)}`),
    enabled: Boolean(classId),
  });
  const register = useQuery({
    queryKey: ["attendance", classId, day],
    queryFn: () => apiGet<Register>(`/api/v1/attendance?classId=${encodeURIComponent(classId)}&day=${day}`),
    enabled: Boolean(classId && day),
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-deep">Pupil attendance</h1>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <div className="flex flex-wrap gap-3 rounded-card border border-line bg-white p-5 shadow-card">
        <select className="rounded-lg border border-line px-3 py-2" value={classId} onChange={(e) => setClassId(e.target.value)}>
          <option value="">Class</option>
          {(tree.data?.classes ?? []).map((cls) => (
            <option key={cls.id} value={cls.id}>
              {cls.label}
            </option>
          ))}
        </select>
        <input className="rounded-lg border border-line px-3 py-2" type="date" value={day} onChange={(e) => setDay(e.target.value)} />
      </div>
      <div className="overflow-x-auto rounded-card border border-line bg-white shadow-card">
        <table className="min-w-full text-sm">
          <thead className="bg-pale text-left">
            <tr>
              <th className="px-4 py-2">Pupil</th>
              <th className="px-4 py-2">Mark</th>
              <th className="px-4 py-2">Reason</th>
            </tr>
          </thead>
          <tbody>
            {(pupils.data?.items ?? []).map((pupil) => {
              const saved = register.data?.items.find((row) => row.pupilId === pupil.id);
              const local = marks[pupil.id];
              const mark = local?.mark ?? saved?.mark ?? "present";
              const reason = local?.reason ?? saved?.reason ?? "";
              return (
                <tr key={pupil.id} className="border-t border-line">
                  <td className="px-4 py-2">
                    {pupil.givenName} {pupil.familyName}
                  </td>
                  <td className="px-4 py-2">
                    <select
                      className="rounded-lg border border-line px-2 py-1"
                      value={mark}
                      disabled={!canSubmit}
                      onChange={(e) =>
                        setMarks((prev) => ({ ...prev, [pupil.id]: { mark: e.target.value, reason } }))
                      }
                    >
                      <option value="present">Present</option>
                      <option value="absent">Absent</option>
                      <option value="late">Late</option>
                      <option value="excused">Excused</option>
                    </select>
                  </td>
                  <td className="px-4 py-2">
                    <input
                      className="w-full rounded-lg border border-line px-2 py-1"
                      value={reason}
                      disabled={!canSubmit}
                      onChange={(e) =>
                        setMarks((prev) => ({ ...prev, [pupil.id]: { mark, reason: e.target.value } }))
                      }
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="p-4">
          <button
            className="rounded-lg bg-purple px-4 py-2 text-white"
            type="button"
            disabled={!canSubmit || !classId}
            onClick={() => {
              setError(null);
              void apiSend("/api/v1/attendance", "POST", {
                classId,
                day,
                entries: (pupils.data?.items ?? []).map((pupil) => {
                  const saved = register.data?.items.find((row) => row.pupilId === pupil.id);
                  const local = marks[pupil.id];
                  return {
                    pupilId: pupil.id,
                    mark: local?.mark ?? saved?.mark ?? "present",
                    reason: local?.reason ?? saved?.reason ?? "",
                  };
                }),
              })
                .then(() => {
                  setMarks({});
                  void queryClient.invalidateQueries({ queryKey: ["attendance"] });
                })
                .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed"));
            }}
          >
            Submit register
          </button>
        </div>
      </div>
    </div>
  );
}
