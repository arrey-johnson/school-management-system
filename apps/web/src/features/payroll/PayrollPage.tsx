import { formatFcfa } from "@sms/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useAuth } from "../../app/AuthProvider";
import { apiGet, apiSend } from "../../lib/api";

type StaffRow = { id: string; givenName: string; familyName: string };
type Component = { id: string; name: string; kind: string; mode: string };
type Run = {
  id: string;
  yearMonth: string;
  status: string;
  totalNetFcfa: number;
  lines: { id: string; netFcfa: number; staffId: string }[];
};

export function PayrollPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const canStaff = user?.roleSlug === "super_admin" || user?.permissions.includes("staff:read");
  const staff = useQuery({
    queryKey: ["staff"],
    queryFn: () => apiGet<{ items: StaffRow[] }>("/api/v1/staff"),
    enabled: Boolean(canStaff),
  });
  const components = useQuery({
    queryKey: ["pay-components"],
    queryFn: () => apiGet<{ items: Component[] }>("/api/v1/payroll/components"),
  });
  const runs = useQuery({ queryKey: ["pay-runs"], queryFn: () => apiGet<{ items: Run[] }>("/api/v1/payroll/runs") });
  const refresh = () => void queryClient.invalidateQueries();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-deep">Payroll</h1>
      <p className="text-sm text-muted">Statutory deduction rates are configurable settings, not legal advice.</p>
      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <form
        className="flex flex-wrap gap-3 rounded-card border border-line bg-white p-5 shadow-card"
        onSubmit={(e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          void apiSend("/api/v1/payroll/components", "POST", {
            name: form.get("name"),
            kind: form.get("kind"),
            mode: form.get("mode"),
            statutory: form.get("statutory") === "on",
          })
            .then(refresh)
            .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed"));
        }}
      >
        <input className="rounded-lg border border-line px-3 py-2" name="name" placeholder="Component name" required />
        <select className="rounded-lg border border-line px-3 py-2" name="kind">
          <option value="allowance">Allowance</option>
          <option value="deduction">Deduction</option>
        </select>
        <select className="rounded-lg border border-line px-3 py-2" name="mode">
          <option value="fixed">Fixed FCFA</option>
          <option value="percent">Percent of base</option>
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="statutory" /> Statutory (configurable)
        </label>
        <button className="rounded-lg bg-purple px-4 py-2 text-white" type="submit">
          Add component
        </button>
      </form>

      <form
        className="grid gap-3 rounded-card border border-line bg-white p-5 shadow-card md:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          const componentTypeId = String(form.get("componentTypeId") ?? "");
          const value = Number(form.get("value"));
          void apiSend("/api/v1/payroll/structures", "POST", {
            staffId: form.get("staffId"),
            baseFcfa: Number(form.get("baseFcfa")),
            effectiveFrom: form.get("effectiveFrom"),
            lines: componentTypeId ? [{ componentTypeId, value }] : [],
          })
            .then(refresh)
            .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed"));
        }}
      >
        <h2 className="md:col-span-2 font-semibold">Salary structure</h2>
        <select className="rounded-lg border border-line px-3 py-2" name="staffId" required>
          <option value="">Staff</option>
          {staff.data?.items.map((row) => (
            <option key={row.id} value={row.id}>
              {row.givenName} {row.familyName}
            </option>
          ))}
        </select>
        <input className="rounded-lg border border-line px-3 py-2" name="baseFcfa" placeholder="Base FCFA" required />
        <input className="rounded-lg border border-line px-3 py-2" name="effectiveFrom" type="date" required />
        <select className="rounded-lg border border-line px-3 py-2" name="componentTypeId">
          <option value="">Optional component</option>
          {components.data?.items.map((row) => (
            <option key={row.id} value={row.id}>
              {row.name}
            </option>
          ))}
        </select>
        <input className="rounded-lg border border-line px-3 py-2" name="value" placeholder="Value (FCFA or %)" />
        <button className="rounded-lg bg-purple px-4 py-2 text-white md:col-span-2" type="submit">
          Save structure
        </button>
      </form>

      <form
        className="flex flex-wrap gap-3 rounded-card border border-line bg-white p-5 shadow-card"
        onSubmit={(e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          void apiSend("/api/v1/payroll/runs", "POST", { yearMonth: form.get("yearMonth") })
            .then(refresh)
            .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed"));
        }}
      >
        <input className="rounded-lg border border-line px-3 py-2" name="yearMonth" placeholder="2026-11" required />
        <button className="rounded-lg bg-purple px-4 py-2 text-white" type="submit">
          Calculate run
        </button>
      </form>

      {runs.data?.items.map((run) => (
        <article key={run.id} className="rounded-card border border-line bg-white p-5 shadow-card">
          <p className="font-semibold">
            {run.yearMonth} · {run.status} · net {formatFcfa(run.totalNetFcfa)}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              className="text-sm text-purple"
              type="button"
              onClick={() => void apiSend(`/api/v1/payroll/runs/${run.id}/approve`, "POST").then(refresh)}
            >
              Approve
            </button>
            <button
              className="text-sm text-purple"
              type="button"
              onClick={() => void apiSend(`/api/v1/payroll/runs/${run.id}/pay`, "POST").then(refresh)}
            >
              Mark paid
            </button>
            <button
              className="text-sm text-purple"
              type="button"
              onClick={() => void apiSend(`/api/v1/payroll/runs/${run.id}/lock`, "POST").then(refresh)}
            >
              Lock
            </button>
            {run.lines[0] ? (
              <a className="text-sm text-purple" href={`/api/v1/payroll/payslips/${run.lines[0].id}/pdf`} target="_blank" rel="noreferrer">
                Payslip PDF
              </a>
            ) : null}
          </div>
        </article>
      ))}
    </div>
  );
}
