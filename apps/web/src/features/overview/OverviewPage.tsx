import { formatFcfa } from "@sms/shared";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "../../lib/api";
import { useAuth } from "../../app/AuthProvider";

export function OverviewPage() {
  const { user } = useAuth();
  const canFees = user?.roleSlug === "super_admin" || user?.permissions.includes("payments:read");
  const school = useQuery({
    queryKey: ["school"],
    queryFn: () => apiGet<{ school: { name: string } | null }>("/api/v1/school"),
  });
  const fees = useQuery({
    queryKey: ["fee-dash"],
    queryFn: () =>
      apiGet<{ outstandingFcfa: number; collectedTodayFcfa: number }>("/api/v1/fees/dashboard"),
    enabled: Boolean(canFees),
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold text-deep">Overview</h1>
      <p className="mt-1 text-muted">Welcome, {user?.displayName}.</p>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <article className="rounded-card border border-line bg-white p-5 shadow-card">
          <p className="text-sm text-muted">School</p>
          <p className="mt-2 text-xl font-semibold">{school.data?.school?.name ?? "—"}</p>
        </article>
        <article className="rounded-card border border-line bg-white p-5 shadow-card">
          <p className="text-sm text-muted">Your role</p>
          <p className="mt-2 text-xl font-semibold">{user?.roleName}</p>
        </article>
        <article className="rounded-card border border-line bg-white p-5 shadow-card">
          <p className="text-sm text-muted">Fees outstanding</p>
          <p className="mt-2 text-xl font-semibold">
            {canFees ? formatFcfa(fees.data?.outstandingFcfa ?? 0) : "—"}
          </p>
        </article>
      </div>
    </div>
  );
}
