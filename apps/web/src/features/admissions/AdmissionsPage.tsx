import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { apiGet, apiSend } from "../../lib/api";

type Level = { id: string; name: string };
type Tree = {
  sections: { levels: Level[] }[];
  classes: { id: string; label: string; levelId: string }[];
};
type Application = {
  id: string;
  status: string;
  givenName: string;
  familyName: string;
  dob: string;
  levelId: string;
  levelName: string;
  guardianPhone: string;
};

export function AdmissionsPage() {
  const queryClient = useQueryClient();
  const list = useQuery({
    queryKey: ["applications"],
    queryFn: () => apiGet<{ items: Application[] }>("/api/v1/applications"),
  });
  const tree = useQuery({ queryKey: ["academic-tree"], queryFn: () => apiGet<Tree>("/api/v1/academic/tree") });
  const [error, setError] = useState<string | null>(null);
  const levels = tree.data?.sections.flatMap((s) => s.levels) ?? [];

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["applications"] });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-deep">Admissions</h1>
      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <form
        className="grid gap-3 rounded-card border border-line bg-white p-5 shadow-card md:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          const formEl = e.currentTarget;
          const form = new FormData(formEl);
          setError(null);
          void apiSend("/api/v1/applications", "POST", {
            givenName: form.get("givenName"),
            familyName: form.get("familyName"),
            sex: form.get("sex"),
            dob: form.get("dob"),
            levelId: form.get("levelId"),
            guardian: {
              givenName: form.get("gGiven"),
              familyName: form.get("gFamily"),
              phone: form.get("gPhone"),
              relationship: form.get("relationship"),
              primaryContact: true,
              feePayer: true,
            },
          })
            .then(() => {
              formEl.reset();
              return refresh();
            })
            .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed"));
        }}
      >
        <h2 className="md:col-span-2 font-semibold">New application</h2>
        <input className="rounded-lg border border-line px-3 py-2" name="givenName" placeholder="Given name" required />
        <input className="rounded-lg border border-line px-3 py-2" name="familyName" placeholder="Family name" required />
        <select className="rounded-lg border border-line px-3 py-2" name="sex" required>
          <option value="F">Female</option>
          <option value="M">Male</option>
        </select>
        <input className="rounded-lg border border-line px-3 py-2" name="dob" type="date" required />
        <select className="rounded-lg border border-line px-3 py-2" name="levelId" required>
          <option value="">Level</option>
          {levels.map((level) => (
            <option key={level.id} value={level.id}>
              {level.name}
            </option>
          ))}
        </select>
        <input className="rounded-lg border border-line px-3 py-2" name="gGiven" placeholder="Guardian given name" required />
        <input className="rounded-lg border border-line px-3 py-2" name="gFamily" placeholder="Guardian family name" required />
        <input className="rounded-lg border border-line px-3 py-2" name="gPhone" placeholder="Guardian phone" required />
        <input className="rounded-lg border border-line px-3 py-2" name="relationship" placeholder="Relationship" defaultValue="Parent" required />
        <button className="rounded-lg bg-purple px-4 py-2 text-white md:col-span-2" type="submit">
          Save application
        </button>
      </form>

      <div className="overflow-hidden rounded-card border border-line bg-white shadow-card">
        <table className="w-full text-left text-sm">
          <thead className="bg-soft text-muted">
            <tr>
              <th className="px-4 py-3">Applicant</th>
              <th>Level</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {list.data?.items.map((row) => (
              <tr key={row.id} className="border-t border-line">
                <td className="px-4 py-3">
                  {row.givenName} {row.familyName}
                  <p className="text-xs text-muted">{row.guardianPhone}</p>
                </td>
                <td>{row.levelName}</td>
                <td>{row.status}</td>
                <td className="space-x-2 py-3">
                  {row.status === "applied" ? (
                    <button
                      className="text-purple"
                      type="button"
                      onClick={() =>
                        void apiSend(`/api/v1/applications/${row.id}/status`, "POST", { status: "under_review" }).then(refresh)
                      }
                    >
                      Review
                    </button>
                  ) : null}
                  {row.status === "under_review" ? (
                    <button
                      className="text-purple"
                      type="button"
                      onClick={() =>
                        void apiSend(`/api/v1/applications/${row.id}/status`, "POST", { status: "accepted" }).then(refresh)
                      }
                    >
                      Accept
                    </button>
                  ) : null}
                  {row.status === "accepted" ? (
                    <select
                      className="rounded border border-line px-2 py-1"
                      defaultValue=""
                      onChange={(e) => {
                        const classId = e.target.value;
                        if (!classId) return;
                        void apiSend(`/api/v1/applications/${row.id}/enrol`, "POST", { classId })
                          .then(refresh)
                          .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed"));
                      }}
                    >
                      <option value="">Enrol in class…</option>
                      {tree.data?.classes
                        .filter((cls) => cls.levelId === row.levelId)
                        .map((cls) => (
                          <option key={cls.id} value={cls.id}>
                            {cls.label}
                          </option>
                        ))}
                    </select>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
