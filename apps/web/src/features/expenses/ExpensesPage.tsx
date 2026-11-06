import { formatFcfa } from "@sms/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { apiGet, apiSend } from "../../lib/api";

type Category = { id: string; name: string };
type Expense = {
  id: string;
  description: string;
  amountFcfa: number;
  status: string;
  entryDate: string;
};

export function ExpensesPage() {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const cats = useQuery({
    queryKey: ["exp-cats"],
    queryFn: () => apiGet<{ items: Category[] }>("/api/v1/expenses/categories"),
  });
  const list = useQuery({ queryKey: ["expenses"], queryFn: () => apiGet<{ items: Expense[] }>("/api/v1/expenses") });
  const refresh = () => void queryClient.invalidateQueries();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-deep">Expenses</h1>
      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <form
        className="flex flex-wrap gap-3 rounded-card border border-line bg-white p-5 shadow-card"
        onSubmit={(e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          void apiSend("/api/v1/expenses/categories", "POST", { name: form.get("name") })
            .then(refresh)
            .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed"));
        }}
      >
        <input className="rounded-lg border border-line px-3 py-2" name="name" placeholder="Category" required />
        <button className="rounded-lg bg-purple px-4 py-2 text-white" type="submit">
          Add category
        </button>
      </form>

      <form
        className="grid gap-3 rounded-card border border-line bg-white p-5 shadow-card md:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          const formEl = e.currentTarget;
          const form = new FormData(formEl);
          void apiSend("/api/v1/expenses", "POST", {
            categoryId: form.get("categoryId"),
            entryDate: form.get("entryDate"),
            amountFcfa: Number(form.get("amountFcfa")),
            description: form.get("description"),
            method: "cash",
          })
            .then(() => {
              formEl.reset();
              refresh();
            })
            .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed"));
        }}
      >
        <h2 className="md:col-span-2 font-semibold">New expense (draft)</h2>
        <select className="rounded-lg border border-line px-3 py-2" name="categoryId" required>
          <option value="">Category</option>
          {cats.data?.items.map((row) => (
            <option key={row.id} value={row.id}>
              {row.name}
            </option>
          ))}
        </select>
        <input className="rounded-lg border border-line px-3 py-2" name="entryDate" type="date" required />
        <input className="rounded-lg border border-line px-3 py-2" name="amountFcfa" placeholder="FCFA" required />
        <input className="rounded-lg border border-line px-3 py-2" name="description" placeholder="Description" required />
        <button className="rounded-lg bg-purple px-4 py-2 text-white md:col-span-2" type="submit">
          Save draft
        </button>
      </form>

      <table className="w-full text-left text-sm rounded-card border border-line bg-white shadow-card">
        <thead className="bg-soft text-muted">
          <tr>
            <th className="px-4 py-3">Date</th>
            <th>Description</th>
            <th>Amount</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {list.data?.items.map((row) => (
            <tr key={row.id} className="border-t border-line">
              <td className="px-4 py-3">{row.entryDate}</td>
              <td>{row.description}</td>
              <td>{formatFcfa(row.amountFcfa)}</td>
              <td>{row.status}</td>
              <td className="space-x-2 py-3">
                {row.status === "draft" ? (
                  <button className="text-purple" type="button" onClick={() => void apiSend(`/api/v1/expenses/${row.id}/submit`, "POST").then(refresh)}>
                    Submit
                  </button>
                ) : null}
                {row.status === "submitted" ? (
                  <button className="text-purple" type="button" onClick={() => void apiSend(`/api/v1/expenses/${row.id}/approve`, "POST").then(refresh)}>
                    Approve
                  </button>
                ) : null}
                {row.status === "approved" ? (
                  <button className="text-purple" type="button" onClick={() => void apiSend(`/api/v1/expenses/${row.id}/pay`, "POST").then(refresh)}>
                    Mark paid
                  </button>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
