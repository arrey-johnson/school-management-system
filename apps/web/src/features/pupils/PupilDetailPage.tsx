import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { apiGet } from "../../lib/api";

type Detail = {
  pupil: {
    admissionNumber: string;
    givenName: string;
    familyName: string;
    dob: string;
    sex: string;
    status: string;
    medicalNotes: string | null;
  };
  guardians: { givenName: string; familyName: string; phone: string; relationship: string }[];
  timeline: { at: string; type: string; summary: string }[];
};

export function PupilDetailPage() {
  const { id } = useParams();
  const detail = useQuery({
    queryKey: ["pupil", id],
    queryFn: () => apiGet<Detail>(`/api/v1/pupils/${id}`),
    enabled: Boolean(id),
  });
  const pupil = detail.data?.pupil;

  if (!pupil) return <p>Loading…</p>;

  return (
    <div className="space-y-6">
      <Link className="text-sm text-purple" to="/pupils">
        ← Directory
      </Link>
      <h1 className="text-2xl font-semibold text-deep">
        {pupil.givenName} {pupil.familyName}
      </h1>
      <p className="text-muted">
        {pupil.admissionNumber} · {pupil.sex} · {pupil.dob} · {pupil.status}
      </p>
      {pupil.medicalNotes ? (
        <p className="rounded-card border border-line bg-white p-4 text-sm">Medical: {pupil.medicalNotes}</p>
      ) : null}

      <article className="rounded-card border border-line bg-white p-5 shadow-card">
        <h2 className="font-semibold">Guardians</h2>
        <ul className="mt-2 text-sm">
          {detail.data?.guardians.map((g) => (
            <li key={g.phone}>
              {g.givenName} {g.familyName} ({g.relationship}) — {g.phone}
            </li>
          ))}
        </ul>
      </article>

      <article className="rounded-card border border-line bg-white p-5 shadow-card">
        <h2 className="font-semibold">Timeline</h2>
        <ol className="mt-3 space-y-2 text-sm">
          {detail.data?.timeline.map((event) => (
            <li key={`${event.at}-${event.summary}`}>
              <span className="text-muted">{event.at.slice(0, 10)}</span> — {event.summary}
            </li>
          ))}
        </ol>
      </article>
    </div>
  );
}
