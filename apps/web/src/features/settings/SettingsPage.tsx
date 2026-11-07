import { RESTORE_CONFIRMATION } from "@sms/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useAuth } from "../../app/AuthProvider";
import { apiGet, apiSend } from "../../lib/api";

type Health = {
  version: string;
  uptimeSeconds: number;
  dbBytes: number;
  hostname: string;
  port: number;
  diskFreeBytes: number | null;
  integrity: string;
  lastBackupAt: string | null;
  lastIntegrity: string | null;
  backupStale: boolean;
  driveEnabled: boolean;
  queuedUploads: number;
  inDocker: boolean;
};

type Status = {
  url: string;
  ips: string[];
  hostname: string;
  qrSvg: string;
  inDocker: boolean;
  version: string;
};

type BackupRow = {
  id: string;
  filename: string;
  integrity: string;
  createdAt: string;
  kind: string;
  bytes: number;
};

export function SettingsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState("");
  const canBackup = user?.roleSlug === "super_admin" || user?.permissions.includes("system:backup");
  const health = useQuery({
    queryKey: ["health"],
    queryFn: () => apiGet<Health>("/api/v1/system/health"),
  });
  const list = useQuery({
    queryKey: ["backups"],
    queryFn: () => apiGet<{ items: BackupRow[] }>("/api/v1/backups"),
    enabled: Boolean(canBackup),
  });
  const status = useQuery({
    queryKey: ["status"],
    queryFn: () => apiGet<Status>("/api/v1/system/status"),
  });
  const data = health.data;
  const refresh = () => void queryClient.invalidateQueries();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-deep">System health</h1>
      {data?.backupStale ? (
        <p className="rounded-card border border-danger bg-white p-4 text-sm text-danger">
          No successful backup in the last 48 hours. Create one before the school day ends.
        </p>
      ) : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <div className="rounded-card border border-line bg-white p-6 shadow-card">
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
          <div>
            <dt className="text-muted">Disk free</dt>
            <dd className="font-medium">{data?.diskFreeBytes != null ? `${data.diskFreeBytes} bytes` : "—"}</dd>
          </div>
          <div>
            <dt className="text-muted">SQLite integrity</dt>
            <dd className="font-medium">{data?.integrity ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-muted">Last backup</dt>
            <dd className="font-medium">{data?.lastBackupAt ?? "never"}</dd>
          </div>
          <div>
            <dt className="text-muted">Google Drive</dt>
            <dd className="font-medium">
              {data?.driveEnabled ? `queued ${data.queuedUploads}` : "off (local only)"}
            </dd>
          </div>
          <div>
            <dt className="text-muted">Runtime</dt>
            <dd className="font-medium">{data?.inDocker ? "Docker Compose" : "unexpected host process"}</dd>
          </div>
        </dl>
        {status.data ? (
          <div className="mt-6 border-t border-line pt-4">
            <p className="text-sm text-muted">Staff PCs open this URL on the school LAN</p>
            <p className="mt-1 font-medium text-deep">{status.data.url}</p>
            <div
              className="mt-3 w-44 bg-white"
              dangerouslySetInnerHTML={{ __html: status.data.qrSvg }}
            />
          </div>
        ) : null}
      </div>

      {canBackup ? (
        <section className="rounded-card border border-line bg-white p-6 shadow-card">
          <h2 className="font-semibold text-deep">Backups</h2>
          <p className="mt-1 text-sm text-muted">
            Snapshots use the SQLite backup API. Restore takes a safety copy first. Type {RESTORE_CONFIRMATION} to
            confirm.
          </p>
          <button
            className="mt-3 rounded-lg bg-purple px-4 py-2 text-white"
            type="button"
            onClick={() => {
              setError(null);
              void apiSend("/api/v1/backups", "POST")
                .then(refresh)
                .catch((err: unknown) => setError(err instanceof Error ? err.message : "Backup failed"));
            }}
          >
            Create backup now
          </button>
          <ul className="mt-4 space-y-2 text-sm">
            {(list.data?.items ?? []).map((row) => (
              <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-line py-2">
                <span>
                  {row.filename} — {row.kind} — {row.integrity}
                </span>
                <button
                  className="rounded-lg border border-line px-3 py-1"
                  type="button"
                  onClick={() => {
                    setError(null);
                    void apiSend("/api/v1/backups/restore", "POST", {
                      filename: row.filename,
                      confirmation: confirm,
                    })
                      .then(refresh)
                      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Restore failed"));
                  }}
                >
                  Restore
                </button>
              </li>
            ))}
          </ul>
          <label className="mt-3 block text-sm">
            Confirmation phrase
            <input
              className="mt-1 w-full rounded-lg border border-line px-3 py-2"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder={RESTORE_CONFIRMATION}
            />
          </label>
        </section>
      ) : null}
    </div>
  );
}
