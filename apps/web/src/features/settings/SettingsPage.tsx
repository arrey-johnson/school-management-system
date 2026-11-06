import { useQuery } from "@tanstack/react-query";
import { apiGet } from "../../lib/api";

type Health = {
  version: string;
  uptimeSeconds: number;
  dbBytes: number;
  hostname: string;
  port: number;
};

export function SettingsPage() {
  const query = useQuery({
    queryKey: ["health"],
    queryFn: () => apiGet<Health>("/api/v1/system/health"),
  });
  const data = query.data;

  return (
    <div>
      <h1 className="text-2xl font-semibold text-deep">System health</h1>
      <div className="mt-4 rounded-card border border-line bg-white p-6 shadow-card">
        <dl className="grid gap-3 text-sm md:grid-cols-2">
          <div>
            <dt className="text-muted">Version</dt>
            <dd className="font-medium">{data?.version ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-muted">Hostname</dt>
            <dd className="font-medium">{data?.hostname ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-muted">Uptime (seconds)</dt>
            <dd className="font-medium">{data?.uptimeSeconds ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-muted">Database size</dt>
            <dd className="font-medium">{data ? `${data.dbBytes} bytes` : "—"}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
