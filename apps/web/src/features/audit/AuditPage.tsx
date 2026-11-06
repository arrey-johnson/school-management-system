import { useQuery } from "@tanstack/react-query";
import { apiGet, apiSend } from "../../lib/api";
import { useState } from "react";

type AuditRow = {
  id: string;
  at: string;
  module: string;
  action: string;
  entity: string;
  actorUserId: string | null;
};

export function AuditPage() {
  const [verify, setVerify] = useState<string | null>(null);
  const query = useQuery({
    queryKey: ["audit"],
    queryFn: () => apiGet<{ items: AuditRow[]; total: number }>("/api/v1/audit"),
  });

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-deep">Audit log</h1>
        <button
          className="rounded-lg bg-purple px-4 py-2 text-sm text-white"
          type="button"
          onClick={() => {
            void apiSend<{ ok: boolean; checked: number }>("/api/v1/audit/verify", "POST").then(
              (res) => setVerify(res.ok ? `Chain intact (${res.checked} rows)` : "Chain broken"),
            );
          }}
        >
          Verify audit integrity
        </button>
      </div>
      {verify ? <p className="mt-3 text-sm text-success">{verify}</p> : null}
      <div className="mt-4 overflow-hidden rounded-card border border-line bg-white shadow-card">
        <table className="w-full text-left text-sm">
          <thead className="bg-soft text-muted">
            <tr>
              <th className="px-4 py-3">When</th>
              <th className="px-4 py-3">Module</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Entity</th>
            </tr>
          </thead>
          <tbody>
            {query.data?.items.map((row) => (
              <tr key={row.id} className="border-t border-line">
                <td className="px-4 py-3">{row.at}</td>
                <td className="px-4 py-3">{row.module}</td>
                <td className="px-4 py-3">{row.action}</td>
                <td className="px-4 py-3">{row.entity}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
