import { formatFcfa } from "@sms/shared";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { apiGet } from "../../lib/api";
import { useAuth } from "../../app/AuthProvider";

const PIE = ["#BF00FF", "#22C55E", "#F59E0B", "#06B6D4", "#EC4899", "#7C3AED"];

type Dash = {
  roleSlug: string;
  pupilCount: number | null;
  staffCount: number | null;
  fees: { collectedTodayFcfa: number; outstandingFcfa: number; collectionRatePercent: number } | null;
  collectionTrend: { month: string; collectedFcfa: number }[];
  enrolmentBySection: { section: string; count: number }[];
  attendanceToday: { marked: number; present: number; absent: number } | null;
  consecutiveAbsences: { pupilId: string; name: string; days: number }[];
  activity: { at: string; title: string; summary: string; when: string }[];
  topArrears: { name: string; balanceFcfa: number }[];
  pendingAdmissions: number | null;
  teacher: { classes: { id: string; label: string }[]; attendanceToSubmit: string[]; marksPending: { id: string }[] };
  announcements: { id: string; title: string; body: string }[];
};

export function OverviewPage() {
  const { user } = useAuth();
  const dash = useQuery({ queryKey: ["dashboard"], queryFn: () => apiGet<Dash>("/api/v1/dashboard") });
  const d = dash.data;
  const attendanceChart = d?.attendanceToday
    ? [
        { name: "Present", value: d.attendanceToday.present },
        { name: "Absent", value: d.attendanceToday.absent },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-deep">Home</h1>
        <p className="text-muted">Hello {user?.displayName}. Here is how the school looks today.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat tone="purple" label="Pupils in school" value={d?.pupilCount ?? "—"} hint="Children currently marked active" />
        <Stat tone="cyan" label="Staff on roll" value={d?.staffCount ?? "—"} hint="Teachers and office staff" />
        <Stat
          tone="green"
          label="Fees collected today"
          value={d?.fees ? formatFcfa(d.fees.collectedTodayFcfa) : "—"}
          hint="Money received today"
        />
        <Stat
          tone="amber"
          label="Fees still unpaid"
          value={d?.fees ? formatFcfa(d.fees.outstandingFcfa) : "—"}
          hint="What families still owe"
        />
      </div>

      {d?.announcements[0] ? (
        <article className="rounded-card border border-line bg-gradient-to-r from-white to-soft p-5 shadow-card">
          <p className="text-sm font-medium text-purple">Notice for staff</p>
          <p className="mt-1 font-semibold text-deep">{d.announcements[0].title}</p>
          <p className="text-sm text-ink">{d.announcements[0].body}</p>
        </article>
      ) : null}

      {user?.roleSlug === "teacher" ? (
        <article className="rounded-card border border-line bg-white p-5 shadow-card">
          <h2 className="font-semibold text-deep">Your classes today</h2>
          <p className="mt-2 text-sm text-muted">
            Attendance still to send: {d?.teacher.attendanceToSubmit.length ?? 0}. Mark sheets still open:{" "}
            {d?.teacher.marksPending.length ?? 0}.
          </p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {(d?.teacher.classes ?? []).map((cls) => (
              <li key={cls.id} className="rounded-full bg-soft px-3 py-1 text-sm text-deep">
                {cls.label}
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap gap-3 text-sm">
            <Link className="rounded-lg bg-purple px-3 py-2 text-white" to="/attendance">
              Take attendance
            </Link>
            <Link className="rounded-lg border border-line px-3 py-2" to="/academics">
              Enter marks
            </Link>
          </div>
        </article>
      ) : null}

      {user?.roleSlug === "secretary" || user?.roleSlug === "super_admin" ? (
        <article className="rounded-card border border-line bg-white p-5 shadow-card">
          <h2 className="font-semibold text-deep">New admissions waiting</h2>
          <p className="mt-2 text-3xl font-semibold text-purple">{d?.pendingAdmissions ?? "—"}</p>
          <p className="text-sm text-muted">Applications that still need a decision.</p>
          <Link className="mt-3 inline-block text-sm font-medium text-purple" to="/admissions">
            Open admissions
          </Link>
        </article>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        {d?.fees ? (
          <article className="rounded-card border border-line bg-white p-5 shadow-card">
            <h2 className="font-semibold text-deep">Fees collected each month</h2>
            <p className="text-sm text-muted">
              {d.fees.collectionRatePercent}% of billed fees has been paid so far this year.
            </p>
            <div className="mt-4 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={d.collectionTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E9C6FF" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip
                    formatter={(value) => formatFcfa(typeof value === "number" ? value : 0)}
                  />
                  <Bar dataKey="collectedFcfa" name="Collected" fill="#BF00FF" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <h3 className="mt-4 text-sm font-semibold">Families who still owe the most</h3>
            <ul className="mt-2 space-y-1 text-sm">
              {d.topArrears.map((row) => (
                <li key={row.name} className="flex justify-between gap-3">
                  <span>{row.name}</span>
                  <span className="font-medium text-danger">{formatFcfa(row.balanceFcfa)}</span>
                </li>
              ))}
            </ul>
          </article>
        ) : null}

        <article className="rounded-card border border-line bg-white p-5 shadow-card">
          <h2 className="font-semibold text-deep">Pupils by section</h2>
          <p className="text-sm text-muted">Nursery, primary and secondary at a glance.</p>
          <div className="mt-4 h-64">
            {(d?.enrolmentBySection ?? []).length ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={d?.enrolmentBySection ?? []}
                    dataKey="count"
                    nameKey="section"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                  >
                    {(d?.enrolmentBySection ?? []).map((row, i) => (
                      <Cell key={row.section} fill={PIE[i % PIE.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted">No class lists yet.</p>
            )}
          </div>
          {attendanceChart.length ? (
            <div className="mt-2 h-40">
              <p className="mb-1 text-sm font-medium">Attendance marked today</p>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={attendanceChart} layout="vertical">
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" width={70} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="value" radius={[0, 8, 8, 0]}>
                    <Cell fill="#22C55E" />
                    <Cell fill="#C0392B" />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : null}
          {(d?.consecutiveAbsences.length ?? 0) > 0 ? (
            <p className="mt-2 text-sm text-danger">
              Missing school 3 days in a row: {d?.consecutiveAbsences.map((a) => `${a.name} (${a.days} days)`).join(", ")}
            </p>
          ) : null}
        </article>
      </div>

      <article className="rounded-card border border-line bg-white p-5 shadow-card">
        <h2 className="font-semibold text-deep">What happened today</h2>
        <p className="text-sm text-muted">Recent work in the school, written in everyday language.</p>
        <ul className="mt-4 space-y-3">
          {(d?.activity ?? []).slice(0, 12).map((row, i) => (
            <li key={`${row.at}-${i}`} className="rounded-xl bg-pale px-4 py-3">
              <p className="font-medium text-deep">{row.title}</p>
              <p className="mt-1 text-sm text-ink">{row.summary}</p>
            </li>
          ))}
          {(d?.activity ?? []).length === 0 ? (
            <li className="text-sm text-muted">Nothing has been recorded yet today.</li>
          ) : null}
        </ul>
      </article>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string | number;
  hint: string;
  tone: "purple" | "green" | "amber" | "cyan";
}) {
  const ring =
    tone === "green"
      ? "from-emerald-50 to-white"
      : tone === "amber"
        ? "from-amber-50 to-white"
        : tone === "cyan"
          ? "from-cyan-50 to-white"
          : "from-soft to-white";
  return (
    <article className={`rounded-card border border-line bg-gradient-to-br ${ring} p-5 shadow-card`}>
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-deep">{value}</p>
      <p className="mt-1 text-xs text-muted">{hint}</p>
    </article>
  );
}
