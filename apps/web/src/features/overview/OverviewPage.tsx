import { formatFcfa } from "@sms/shared";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { apiGet } from "../../lib/api";
import { useAuth } from "../../app/AuthProvider";

type Dash = {
  roleSlug: string;
  pupilCount: number | null;
  staffCount: number | null;
  fees: { collectedTodayFcfa: number; outstandingFcfa: number; collectionRatePercent: number } | null;
  collectionTrend: { month: string; collectedFcfa: number }[];
  enrolmentBySection: { section: string; count: number }[];
  attendanceToday: { marked: number; present: number; absent: number } | null;
  consecutiveAbsences: { pupilId: string; name: string; days: number }[];
  activity: { at: string; module: string; action: string }[];
  topArrears: { name: string; balanceFcfa: number }[];
  pendingAdmissions: number | null;
  teacher: { classes: { id: string; label: string }[]; attendanceToSubmit: string[]; marksPending: { id: string }[] };
  announcements: { id: string; title: string; body: string }[];
};

export function OverviewPage() {
  const { user } = useAuth();
  const dash = useQuery({ queryKey: ["dashboard"], queryFn: () => apiGet<Dash>("/api/v1/dashboard") });
  const d = dash.data;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-deep">Overview</h1>
      <p className="text-muted">Welcome, {user?.displayName}.</p>

      <div className="grid gap-4 md:grid-cols-4">
        <Stat label="Pupils" value={d?.pupilCount ?? "—"} />
        <Stat label="Staff" value={d?.staffCount ?? "—"} />
        <Stat label="Collected today" value={d?.fees ? formatFcfa(d.fees.collectedTodayFcfa) : "—"} />
        <Stat label="Outstanding" value={d?.fees ? formatFcfa(d.fees.outstandingFcfa) : "—"} />
      </div>

      {d?.announcements[0] ? (
        <article className="rounded-card border border-line bg-white p-5 shadow-card">
          <p className="text-sm text-muted">Announcement</p>
          <p className="mt-1 font-semibold text-deep">{d.announcements[0].title}</p>
          <p className="text-sm">{d.announcements[0].body}</p>
        </article>
      ) : null}

      {user?.roleSlug === "teacher" ? (
        <article className="rounded-card border border-line bg-white p-5 shadow-card">
          <h2 className="font-semibold text-deep">My classes</h2>
          <p className="mt-2 text-sm">
            Attendance to submit today: {d?.teacher.attendanceToSubmit.length ?? 0}. Marks pending:{" "}
            {d?.teacher.marksPending.length ?? 0}.
          </p>
          <ul className="mt-2 text-sm">
            {(d?.teacher.classes ?? []).map((cls) => (
              <li key={cls.id}>{cls.label}</li>
            ))}
          </ul>
          <div className="mt-3 flex gap-3 text-sm">
            <Link className="text-purple" to="/attendance">
              Attendance
            </Link>
            <Link className="text-purple" to="/academics">
              Marks
            </Link>
          </div>
        </article>
      ) : null}

      {user?.roleSlug === "secretary" || user?.roleSlug === "super_admin" ? (
        <article className="rounded-card border border-line bg-white p-5 shadow-card">
          <h2 className="font-semibold text-deep">Admissions queue</h2>
          <p className="mt-2 text-xl font-semibold">{d?.pendingAdmissions ?? "—"} pending</p>
          <Link className="mt-2 inline-block text-sm text-purple" to="/admissions">
            Open admissions
          </Link>
        </article>
      ) : null}

      {d?.fees ? (
        <article className="rounded-card border border-line bg-white p-5 shadow-card">
          <h2 className="font-semibold text-deep">Fee collection by month</h2>
          <p className="text-sm text-muted">Collection rate {d.fees.collectionRatePercent}%</p>
          <ul className="mt-3 space-y-1 text-sm">
            {d.collectionTrend.map((row) => (
              <li key={row.month} className="flex justify-between">
                <span>{row.month}</span>
                <span>{formatFcfa(row.collectedFcfa)}</span>
              </li>
            ))}
          </ul>
          <h3 className="mt-4 text-sm font-semibold">Top arrears</h3>
          <ul className="text-sm">
            {d.topArrears.map((row) => (
              <li key={row.name}>
                {row.name} — {formatFcfa(row.balanceFcfa)}
              </li>
            ))}
          </ul>
        </article>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <article className="rounded-card border border-line bg-white p-5 shadow-card">
          <h2 className="font-semibold text-deep">Enrolment by section</h2>
          <ul className="mt-2 text-sm">
            {(d?.enrolmentBySection ?? []).map((row) => (
              <li key={row.section}>
                {row.section}: {row.count}
              </li>
            ))}
          </ul>
          {d?.attendanceToday ? (
            <p className="mt-3 text-sm">
              Attendance today: {d.attendanceToday.present} present / {d.attendanceToday.absent} absent of{" "}
              {d.attendanceToday.marked} marked
            </p>
          ) : null}
          {(d?.consecutiveAbsences.length ?? 0) > 0 ? (
            <p className="mt-2 text-sm text-danger">
              Consecutive absences: {d?.consecutiveAbsences.map((a) => `${a.name} (${a.days}d)`).join(", ")}
            </p>
          ) : null}
        </article>
        <article className="rounded-card border border-line bg-white p-5 shadow-card">
          <h2 className="font-semibold text-deep">Today&apos;s activity</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {(d?.activity ?? []).slice(0, 12).map((row, i) => (
              <li key={`${row.at}-${i}`}>
                {row.module}:{row.action}
              </li>
            ))}
          </ul>
        </article>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <article className="rounded-card border border-line bg-white p-5 shadow-card">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-2 text-xl font-semibold">{value}</p>
    </article>
  );
}
