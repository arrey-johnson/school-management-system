import { POWERED_BY } from "@sms/shared";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../app/AuthProvider";
import { apiGet, apiSend, type MeUser } from "../../lib/api";

type Status = {
  complete: boolean;
  hasUsers: boolean;
  hasSchool: boolean;
  hasAcademicYear: boolean;
};

export function SetupPage() {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [displayName, setDisplayName] = useState("School Administrator");
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [schoolName, setSchoolName] = useState("ALL BRIGHT CHILDREN");
  const [yearName, setYearName] = useState("2026/2027");

  const load = () => {
    void apiGet<Status>("/api/v1/setup/status").then(setStatus);
  };

  useEffect(() => {
    load();
  }, []);

  if (!status) return <p className="p-8">Loading…</p>;
  if (status.complete) {
    return (
      <div className="p-8">
        Setup is complete.{" "}
        <button className="text-purple underline" type="button" onClick={() => navigate("/")}>
          Open the app
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl p-8">
      <h1 className="text-2xl font-semibold text-deep">First-run setup</h1>
      <p className="mt-2 text-muted">Create the Super Admin, school profile, and the first academic year.</p>
      {error ? <p className="mt-4 text-sm text-danger">{error}</p> : null}

      {!status.hasUsers ? (
        <form
          className="mt-6 space-y-3 rounded-card border border-line bg-white p-6 shadow-card"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            void apiSend("/api/v1/setup/bootstrap", "POST", { username, password, displayName })
              .then(() =>
                apiSend<{ user: MeUser }>("/api/v1/auth/login", "POST", { username, password }),
              )
              .then((result) => {
                setUser(result.user);
                load();
              })
              .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed"));
          }}
        >
          <h2 className="font-semibold">1. Super Admin</h2>
          <input
            className="w-full rounded-lg border border-line px-3 py-2"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
          />
          <input
            className="w-full rounded-lg border border-line px-3 py-2"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
          <input
            className="w-full rounded-lg border border-line px-3 py-2"
            type="password"
            placeholder="Password (min 10 characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={10}
            required
          />
          <button className="rounded-lg bg-purple px-4 py-2 text-white" type="submit">
            Create administrator
          </button>
        </form>
      ) : null}

      {status.hasUsers && !status.hasSchool ? (
        <form
          className="mt-6 space-y-3 rounded-card border border-line bg-white p-6 shadow-card"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            void apiSend("/api/v1/setup/school", "POST", {
              name: schoolName,
              motto: "",
              address: "",
              phone: "",
              email: "",
            })
              .then(load)
              .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed"));
          }}
        >
          <h2 className="font-semibold">2. School profile</h2>
          <input
            className="w-full rounded-lg border border-line px-3 py-2"
            value={schoolName}
            onChange={(e) => setSchoolName(e.target.value)}
            required
          />
          <button className="rounded-lg bg-purple px-4 py-2 text-white" type="submit">
            Save school
          </button>
        </form>
      ) : null}

      {status.hasSchool && !status.hasAcademicYear ? (
        <form
          className="mt-6 space-y-3 rounded-card border border-line bg-white p-6 shadow-card"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            void apiSend("/api/v1/setup/academic-year", "POST", {
              name: yearName,
              startDate: "2026-09-01",
              endDate: "2027-06-30",
              terms: [
                { name: "Term 1", startDate: "2026-09-01", endDate: "2026-12-15" },
                { name: "Term 2", startDate: "2027-01-08", endDate: "2027-03-31" },
                { name: "Term 3", startDate: "2027-04-14", endDate: "2027-06-30" },
              ],
            })
              .then(load)
              .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed"));
          }}
        >
          <h2 className="font-semibold">3. Academic year (3 terms)</h2>
          <input
            className="w-full rounded-lg border border-line px-3 py-2"
            value={yearName}
            onChange={(e) => setYearName(e.target.value)}
            required
          />
          <p className="text-sm text-muted">
            Default Cameroon term dates are used. You can adjust them in a later phase.
          </p>
          <button className="rounded-lg bg-purple px-4 py-2 text-white" type="submit">
            Create year and sections
          </button>
        </form>
      ) : null}

      {status.hasSchool && status.hasAcademicYear ? (
        <button
          className="mt-6 rounded-lg bg-purple px-4 py-2 text-white"
          type="button"
          onClick={() => {
            setError(null);
            void apiSend("/api/v1/setup/complete", "POST")
              .then(() => navigate("/"))
              .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed"));
          }}
        >
          Finish setup
        </button>
      ) : null}
      <p className="mt-8 text-center text-xs text-muted">{POWERED_BY}</p>
    </div>
  );
}
