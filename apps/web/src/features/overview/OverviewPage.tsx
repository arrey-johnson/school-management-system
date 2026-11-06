import { useQuery } from "@tanstack/react-query";
import { apiGet } from "../../lib/api";
import { useAuth } from "../../app/AuthProvider";

export function OverviewPage() {
  const { user } = useAuth();
  const school = useQuery({
    queryKey: ["school"],
    queryFn: () => apiGet<{ school: { name: string } | null }>("/api/v1/school"),
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
          <p className="text-sm text-muted">Phase 1</p>
          <p className="mt-2 text-xl font-semibold text-success">Foundation ready</p>
        </article>
      </div>
    </div>
  );
}
