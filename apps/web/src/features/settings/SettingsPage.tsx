import {
  DEMO_ACCOUNTS,
  DEMO_LOAD_CONFIRMATION,
  DEMO_PASSWORD,
  DEMO_RESET_CONFIRMATION,
  RESTORE_CONFIRMATION,
} from "@sms/shared";
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
  const [busy, setBusy] = useState<"load" | "reset" | null>(null);
  const [pending, setPending] = useState<"load" | "reset" | null>(null);
  const canBackup = user?.roleSlug === "super_admin" || user?.permissions.includes("system:backup");
  const canDemo = user?.roleSlug === "super_admin";
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
  const demo = useQuery({
    queryKey: ["demo"],
    queryFn: () =>
      apiGet<{ loaded: boolean; setupComplete: boolean; counts: { pupils: number; staff: number; users: number } }>(
        "/api/v1/system/demo",
      ),
    enabled: canDemo,
  });
  const data = health.data;
  const refresh = () => void queryClient.invalidateQueries();
  const runDemo = (action: "load" | "reset") => {
    setError(null);
    setPending(null);
    setBusy(action);
    const path = action === "load" ? "/api/v1/system/demo/load" : "/api/v1/system/demo/reset";
    const confirmation = action === "load" ? DEMO_LOAD_CONFIRMATION : DEMO_RESET_CONFIRMATION;
    void apiSend(path, "POST", { confirmation })
      .then(() => refresh())
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Demo action failed"))
      .finally(() => setBusy(null));
  };

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

      {canDemo ? (
        <section className="rounded-card border border-line bg-white p-6 shadow-card" aria-busy={Boolean(busy)}>
          <h2 className="font-semibold text-deep">Demo data</h2>
          <p className="mt-1 text-sm text-muted">
            Fill the school with fictional pupils, staff, fees and sample activity so you can click through every
            screen. When testing is finished, reset removes only that demo data and leaves the school profile ready
            for official records.
          </p>
          {demo.data?.loaded ? (
            <p className="mt-3 text-sm text-ink">
              Demo is loaded ({demo.data.counts.pupils} pupils, {demo.data.counts.staff} staff, {demo.data.counts.users}{" "}
              demo users). Sign-in password for demo role accounts: {DEMO_PASSWORD}. Usernames:{" "}
              {DEMO_ACCOUNTS.map((account) => account.username).join(", ")}.
            </p>
          ) : (
            <p className="mt-3 text-sm text-ink">
              Demo is not loaded. Finish first-run setup first, then load demo data.
            </p>
          )}
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              className="rounded-lg bg-purple px-4 py-2 text-white disabled:opacity-50"
              type="button"
              disabled={Boolean(busy)}
              onClick={() => {
                setError(null);
                setPending("load");
              }}
            >
              Fill with demo data
            </button>
            <button
              className="rounded-lg border border-danger px-4 py-2 text-danger disabled:opacity-50"
              type="button"
              disabled={Boolean(busy)}
              onClick={() => {
                setError(null);
                setPending("reset");
              }}
            >
              Reset demo data
            </button>
          </div>
          {pending ? (
            <div className="mt-4 rounded-lg border border-line bg-pale p-4" role="alertdialog" aria-labelledby="demo-confirm-title">
              <p id="demo-confirm-title" className="font-medium text-deep">
                {pending === "load" ? "Load fictional demo data?" : "Remove all demo data?"}
              </p>
              <p className="mt-1 text-sm text-muted">
                {pending === "load"
                  ? "This adds sample pupils, staff, fees and activity. It can take up to a minute."
                  : "This deletes demo pupils, payments and demo logins. Your school profile and Super Admin account stay."}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  className="rounded-lg bg-purple px-4 py-2 text-white"
                  type="button"
                  onClick={() => runDemo(pending)}
                >
                  {pending === "load" ? "Yes, load demo data" : "Yes, reset demo data"}
                </button>
                <button
                  className="rounded-lg border border-line px-4 py-2"
                  type="button"
                  onClick={() => setPending(null)}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}
      {busy ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50"
          role="status"
          aria-live="assertive"
        >
          <div className="mx-4 max-w-sm rounded-card bg-white p-8 text-center shadow-card">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-soft border-t-purple" />
            <p className="mt-4 font-semibold text-deep">
              {busy === "load" ? "Loading demo data…" : "Resetting demo data…"}
            </p>
            <p className="mt-1 text-sm text-muted">Keep this page open until it finishes.</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
