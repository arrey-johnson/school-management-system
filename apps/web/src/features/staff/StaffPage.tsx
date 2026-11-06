import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { apiGet, apiSend } from "../../lib/api";

type StaffRow = {
  id: string;
  givenName: string;
  familyName: string;
  position: string;
  phone: string;
  status: string;
  nationalId: string | null;
};

export function StaffPage() {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const list = useQuery({ queryKey: ["staff"], queryFn: () => apiGet<{ items: StaffRow[] }>("/api/v1/staff") });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-deep">Staff</h1>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <form
        className="grid gap-3 rounded-card border border-line bg-white p-5 shadow-card md:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          const formEl = e.currentTarget;
          const form = new FormData(formEl);
          setError(null);
          void apiSend("/api/v1/staff", "POST", {
            givenName: form.get("givenName"),
            familyName: form.get("familyName"),
            sex: form.get("sex"),
            phone: form.get("phone"),
            position: form.get("position"),
            hireDate: form.get("hireDate"),
            nationalId: form.get("nationalId"),
            employmentType: "full_time",
          })
            .then(() => {
              formEl.reset();
              return queryClient.invalidateQueries({ queryKey: ["staff"] });
            })
            .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed"));
        }}
      >
        <h2 className="md:col-span-2 font-semibold">Add staff</h2>
        <input className="rounded-lg border border-line px-3 py-2" name="givenName" placeholder="Given name" required />
        <input className="rounded-lg border border-line px-3 py-2" name="familyName" placeholder="Family name" required />
        <select className="rounded-lg border border-line px-3 py-2" name="sex" required>
          <option value="F">Female</option>
          <option value="M">Male</option>
        </select>
        <input className="rounded-lg border border-line px-3 py-2" name="phone" placeholder="Phone" required />
        <input className="rounded-lg border border-line px-3 py-2" name="position" placeholder="Position" required />
        <input className="rounded-lg border border-line px-3 py-2" name="hireDate" type="date" required />
        <input className="rounded-lg border border-line px-3 py-2" name="nationalId" placeholder="National ID (restricted)" />
        <button className="rounded-lg bg-purple px-4 py-2 text-white md:col-span-2" type="submit">
          Save staff
        </button>
      </form>
      <table className="w-full text-left text-sm rounded-card border border-line bg-white shadow-card">
        <thead className="bg-soft text-muted">
          <tr>
            <th className="px-4 py-3">Name</th>
            <th>Position</th>
            <th>Phone</th>
            <th>National ID</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {list.data?.items.map((row) => (
            <tr key={row.id} className="border-t border-line">
              <td className="px-4 py-3">
                {row.givenName} {row.familyName}
              </td>
              <td>{row.position}</td>
              <td>{row.phone}</td>
              <td>{row.nationalId ?? "—"}</td>
              <td>{row.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
