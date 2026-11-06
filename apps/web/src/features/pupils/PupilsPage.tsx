import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { apiGet, apiSend } from "../../lib/api";

type Pupil = {
  id: string;
  admissionNumber: string;
  givenName: string;
  familyName: string;
  status: string;
  classLabel: string | null;
};
type Tree = { classes: { id: string; label: string }[] };

function parseCsv(text: string) {
  const lines = text.trim().split(/\r?\n/);
  const header = (lines[0] ?? "").split(",").map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cols = line.split(",").map((c) => c.trim());
    const row: Record<string, string> = {};
    header.forEach((h, i) => {
      row[h] = cols[i] ?? "";
    });
    return {
      givenName: row.givenName,
      familyName: row.familyName,
      sex: row.sex as "F" | "M",
      dob: row.dob,
      classStream: row.classStream,
      guardianGivenName: row.guardianGivenName,
      guardianFamilyName: row.guardianFamilyName,
      guardianPhone: row.guardianPhone,
      relationship: row.relationship || "Parent",
    };
  });
}

export function PupilsPage() {
  const queryClient = useQueryClient();
  const [q, setQ] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [importPreview, setImportPreview] = useState<string | null>(null);
  const pupils = useQuery({
    queryKey: ["pupils", q],
    queryFn: () => apiGet<{ items: Pupil[] }>(`/api/v1/pupils?q=${encodeURIComponent(q)}`),
  });
  const tree = useQuery({ queryKey: ["academic-tree"], queryFn: () => apiGet<Tree>("/api/v1/academic/tree") });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-deep">Pupils</h1>
      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <input
        className="w-full max-w-md rounded-lg border border-line px-3 py-2"
        placeholder="Search name, admission number, or guardian phone"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />

      <form
        className="grid gap-3 rounded-card border border-line bg-white p-5 shadow-card md:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          const formEl = e.currentTarget;
          const form = new FormData(formEl);
          setError(null);
          void apiSend("/api/v1/pupils", "POST", {
            givenName: form.get("givenName"),
            familyName: form.get("familyName"),
            sex: form.get("sex"),
            dob: form.get("dob"),
            classId: form.get("classId"),
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
              return queryClient.invalidateQueries({ queryKey: ["pupils"] });
            })
            .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed"));
        }}
      >
        <h2 className="md:col-span-2 font-semibold">Enrol a pupil</h2>
        <input className="rounded-lg border border-line px-3 py-2" name="givenName" placeholder="Given name" required />
        <input className="rounded-lg border border-line px-3 py-2" name="familyName" placeholder="Family name" required />
        <select className="rounded-lg border border-line px-3 py-2" name="sex" required>
          <option value="F">Female</option>
          <option value="M">Male</option>
        </select>
        <input className="rounded-lg border border-line px-3 py-2" name="dob" type="date" required />
        <select className="rounded-lg border border-line px-3 py-2" name="classId" required>
          <option value="">Class</option>
          {tree.data?.classes.map((cls) => (
            <option key={cls.id} value={cls.id}>
              {cls.label}
            </option>
          ))}
        </select>
        <input className="rounded-lg border border-line px-3 py-2" name="gGiven" placeholder="Guardian given name" required />
        <input className="rounded-lg border border-line px-3 py-2" name="gFamily" placeholder="Guardian family name" required />
        <input className="rounded-lg border border-line px-3 py-2" name="gPhone" placeholder="Guardian phone" required />
        <input className="rounded-lg border border-line px-3 py-2" name="relationship" defaultValue="Parent" required />
        <button className="rounded-lg bg-purple px-4 py-2 text-white md:col-span-2" type="submit">
          Enrol
        </button>
      </form>

      <article className="rounded-card border border-line bg-white p-5 shadow-card">
        <h2 className="font-semibold">Bulk import (CSV)</h2>
        <p className="mt-1 text-sm text-muted">
          Headers: givenName,familyName,sex,dob,classStream,guardianGivenName,guardianFamilyName,guardianPhone,relationship
        </p>
        <input
          className="mt-3 block"
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            void file.text().then((text) => {
              const rows = parseCsv(text);
              setError(null);
              void apiSend<{ dryRun: boolean; valid: boolean; errors: { row: number; message: string }[] }>(
                "/api/v1/pupils/import",
                "POST",
                { dryRun: true, rows },
              )
                .then((result) => {
                  if (!result.valid) {
                    setImportPreview(result.errors.map((err) => `Row ${err.row}: ${err.message}`).join("; "));
                    return;
                  }
                  return apiSend<{ created: number }>("/api/v1/pupils/import", "POST", { dryRun: false, rows }).then(
                    (commit) => {
                      setImportPreview(`Imported ${commit.created} pupils`);
                      return queryClient.invalidateQueries({ queryKey: ["pupils"] });
                    },
                  );
                })
                .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed"));
            });
          }}
        />
        {importPreview ? <p className="mt-2 text-sm">{importPreview}</p> : null}
      </article>

      <div className="overflow-hidden rounded-card border border-line bg-white shadow-card">
        <table className="w-full text-left text-sm">
          <thead className="bg-soft text-muted">
            <tr>
              <th className="px-4 py-3">Admission</th>
              <th>Name</th>
              <th>Class</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {pupils.data?.items.map((row) => (
              <tr key={row.id} className="border-t border-line">
                <td className="px-4 py-3">
                  <Link className="text-purple" to={`/pupils/${row.id}`}>
                    {row.admissionNumber}
                  </Link>
                </td>
                <td>
                  {row.givenName} {row.familyName}
                </td>
                <td>{row.classLabel ?? "—"}</td>
                <td>{row.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
