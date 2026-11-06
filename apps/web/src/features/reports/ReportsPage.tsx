import { REPORT_KINDS, type ReportKind } from "@sms/shared";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { apiBlob, apiGet } from "../../lib/api";

type Table = { title: string; generatedBy: string; generatedAt: string; headers: string[]; rows: Array<Array<string | number | null>> };

export function ReportsPage() {
  const [kind, setKind] = useState<ReportKind>("pupils");
  const [error, setError] = useState<string | null>(null);
  const report = useQuery({
    queryKey: ["report", kind],
    queryFn: () => apiGet<Table>(`/api/v1/reports/${kind}`),
  });

  const download = (format: "csv" | "pdf") => {
    setError(null);
    void apiBlob(`/api/v1/reports/${kind}?format=${format}`)
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${kind}.${format === "csv" ? "csv" : "pdf"}`;
        a.click();
        URL.revokeObjectURL(url);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Export failed"));
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-deep">Reports</h1>
      <p className="text-sm text-muted">On-screen table, print, PDF, and Excel (CSV). Exports are audited.</p>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <div className="flex flex-wrap gap-3 rounded-card border border-line bg-white p-5 shadow-card">
        <select className="rounded-lg border border-line px-3 py-2" value={kind} onChange={(e) => setKind(e.target.value as ReportKind)}>
          {REPORT_KINDS.map((item) => (
            <option key={item} value={item}>
              {item.replace(/_/g, " ")}
            </option>
          ))}
        </select>
        <button className="rounded-lg border border-line px-4 py-2" type="button" onClick={() => window.print()}>
          Print
        </button>
        <button className="rounded-lg bg-purple px-4 py-2 text-white" type="button" onClick={() => download("csv")}>
          Excel
        </button>
        <button className="rounded-lg border border-line px-4 py-2" type="button" onClick={() => download("pdf")}>
          PDF
        </button>
      </div>
      {report.error ? <p className="text-sm text-danger">{(report.error as Error).message}</p> : null}
      <div className="overflow-x-auto rounded-card border border-line bg-white shadow-card">
        <div className="border-b border-line px-4 py-3 text-sm text-muted">
          {report.data?.title} — {report.data?.generatedBy} — {report.data?.generatedAt}
        </div>
        <table className="min-w-full text-sm">
          <thead className="bg-pale text-left">
            <tr>
              {(report.data?.headers ?? []).map((h) => (
                <th key={h} className="px-4 py-2">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(report.data?.rows ?? []).map((row, index) => (
              <tr key={index} className="border-t border-line">
                {row.map((cell, i) => (
                  <td key={i} className="px-4 py-2">
                    {cell ?? "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
