import { formatFcfa } from "@sms/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { apiGet, apiSend } from "../../lib/api";

type Dashboard = {
  chargedFcfa: number;
  outstandingFcfa: number;
  collectedTodayFcfa: number;
  collectedYearFcfa: number;
  collectionRatePercent: number;
};
type FeeItem = { id: string; code: string; name: string; amountFcfa: number; mandatory: boolean };
type Arrear = { pupilId: string; name: string; admissionNumber: string; balanceFcfa: number; status: string };
type InvoiceRow = { id: string; pupilId: string; account: { balanceFcfa: number; status: string; netDueFcfa: number } };
type Approval = { id: string; kind: string; status: string; requestedBy: string };
type Tree = { years: { id: string }[] };

export function FeesPage() {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [pupilId, setPupilId] = useState("");
  const dash = useQuery({ queryKey: ["fee-dash"], queryFn: () => apiGet<Dashboard>("/api/v1/fees/dashboard") });
  const items = useQuery({ queryKey: ["fee-items"], queryFn: () => apiGet<{ items: FeeItem[] }>("/api/v1/fees/items") });
  const arrears = useQuery({ queryKey: ["arrears"], queryFn: () => apiGet<{ items: Arrear[] }>("/api/v1/fees/arrears") });
  const invoices = useQuery({
    queryKey: ["invoices", pupilId],
    queryFn: () => apiGet<{ items: InvoiceRow[] }>(`/api/v1/fees/invoices?pupilId=${encodeURIComponent(pupilId)}`),
    enabled: pupilId.length > 5,
  });
  const approvals = useQuery({
    queryKey: ["approvals"],
    queryFn: () => apiGet<{ items: Approval[] }>("/api/v1/approvals"),
  });
  const tree = useQuery({ queryKey: ["academic-tree"], queryFn: () => apiGet<Tree>("/api/v1/academic/tree") });
  const yearId = tree.data?.years[0]?.id ?? "";

  const refresh = () => {
    void queryClient.invalidateQueries();
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-deep">Fees and payments</h1>
      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <div className="grid gap-4 md:grid-cols-4">
        <article className="rounded-card border border-line bg-white p-4 shadow-card">
          <p className="text-sm text-muted">Charged</p>
          <p className="mt-1 text-lg font-semibold">{formatFcfa(dash.data?.chargedFcfa ?? 0)}</p>
        </article>
        <article className="rounded-card border border-line bg-white p-4 shadow-card">
          <p className="text-sm text-muted">Outstanding</p>
          <p className="mt-1 text-lg font-semibold">{formatFcfa(dash.data?.outstandingFcfa ?? 0)}</p>
        </article>
        <article className="rounded-card border border-line bg-white p-4 shadow-card">
          <p className="text-sm text-muted">Collected today</p>
          <p className="mt-1 text-lg font-semibold">{formatFcfa(dash.data?.collectedTodayFcfa ?? 0)}</p>
        </article>
        <article className="rounded-card border border-line bg-white p-4 shadow-card">
          <p className="text-sm text-muted">Collection rate</p>
          <p className="mt-1 text-lg font-semibold">{dash.data?.collectionRatePercent ?? 0}%</p>
        </article>
      </div>

      <article className="rounded-card border border-line bg-white p-5 shadow-card">
        <h2 className="font-semibold">Fee items</h2>
        <form
          className="mt-3 flex flex-wrap gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            setError(null);
            void apiSend("/api/v1/fees/items", "POST", {
              code: form.get("code"),
              name: form.get("name"),
              amountFcfa: Number(form.get("amountFcfa")),
              mandatory: true,
              scope: "year",
              academicYearId: yearId,
            })
              .then(refresh)
              .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed"));
          }}
        >
          <input className="rounded-lg border border-line px-3 py-2" name="code" placeholder="Code" required />
          <input className="rounded-lg border border-line px-3 py-2" name="name" placeholder="Name" required />
          <input className="rounded-lg border border-line px-3 py-2" name="amountFcfa" placeholder="FCFA" required />
          <button className="rounded-lg bg-purple px-4 py-2 text-white" type="submit">
            Add item
          </button>
        </form>
        <ul className="mt-3 text-sm">
          {items.data?.items.map((item) => (
            <li key={item.id}>
              {item.code} — {item.name} — {formatFcfa(item.amountFcfa)}
            </li>
          ))}
        </ul>
      </article>

      <article className="rounded-card border border-line bg-white p-5 shadow-card">
        <h2 className="font-semibold">Record a payment</h2>
        <form
          className="mt-3 grid gap-3 md:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            const formEl = e.currentTarget;
            const form = new FormData(formEl);
            const q = String(form.get("pupilQuery"));
            setError(null);
            void apiGet<{ items: { id: string }[] }>(`/api/v1/pupils?q=${encodeURIComponent(q)}`)
              .then((found) => {
                const id = found.items[0]?.id;
                if (!id) throw new Error("No pupil matched that search");
                setPupilId(id);
                return apiSend("/api/v1/payments", "POST", {
              pupilId: id,
              amountFcfa: Number(form.get("amountFcfa")),
              channel: form.get("channel"),
              entryDate: form.get("entryDate"),
              payerName: form.get("payerName"),
              confirmDuplicate: true,
                });
              })
              .then((res) => {
                const paid = res as { receiptId: string };
                formEl.reset();
                window.open(`/api/v1/receipts/${paid.receiptId}/pdf`, "_blank");
                refresh();
              })
              .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed"));
          }}
        >
          <input
            className="rounded-lg border border-line px-3 py-2"
            name="pupilQuery"
            placeholder="Admission no. or name"
            required
          />
          <input className="rounded-lg border border-line px-3 py-2" name="payerName" placeholder="Payer name" required />
          <input className="rounded-lg border border-line px-3 py-2" name="amountFcfa" placeholder="Amount FCFA" required />
          <input className="rounded-lg border border-line px-3 py-2" name="entryDate" type="date" required />
          <select className="rounded-lg border border-line px-3 py-2" name="channel" defaultValue="cash">
            <option value="cash">Cash</option>
            <option value="mtn_momo">MTN MoMo</option>
            <option value="orange_money">Orange Money</option>
            <option value="bank">Bank</option>
            <option value="cheque">Cheque</option>
            <option value="other">Other</option>
          </select>
          <button className="rounded-lg bg-purple px-4 py-2 text-white" type="submit">
            Record payment
          </button>
        </form>
        {invoices.data?.items[0] ? (
          <p className="mt-3 text-sm">
            Balance {formatFcfa(invoices.data.items[0].account.balanceFcfa)} ({invoices.data.items[0].account.status})
          </p>
        ) : null}
      </article>

      <article className="rounded-card border border-line bg-white p-5 shadow-card">
        <h2 className="font-semibold">Arrears</h2>
        <table className="mt-3 w-full text-left text-sm">
          <thead className="text-muted">
            <tr>
              <th className="py-2">Pupil</th>
              <th>Balance</th>
            </tr>
          </thead>
          <tbody>
            {arrears.data?.items.map((row) => (
              <tr key={row.pupilId} className="border-t border-line">
                <td className="py-2">
                  {row.name} ({row.admissionNumber})
                </td>
                <td>{formatFcfa(row.balanceFcfa)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </article>

      <article className="rounded-card border border-line bg-white p-5 shadow-card">
        <h2 className="font-semibold">Approvals</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {approvals.data?.items
            .filter((row) => row.status === "pending")
            .map((row) => (
              <li key={row.id} className="flex gap-3">
                <span>
                  {row.kind} · {row.id.slice(0, 8)}
                </span>
                <button
                  className="text-purple"
                  type="button"
                  onClick={() =>
                    void apiSend(`/api/v1/approvals/${row.id}/decide`, "POST", { decision: "approved" }).then(refresh)
                  }
                >
                  Approve
                </button>
              </li>
            ))}
        </ul>
      </article>

      <article className="rounded-card border border-line bg-white p-5 shadow-card">
        <h2 className="font-semibold">Cash-up and period lock</h2>
        <form
          className="mt-3 flex flex-wrap gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            void apiSend("/api/v1/cash-ups", "POST", {
              day: form.get("day"),
              countedCashFcfa: Number(form.get("countedCashFcfa")),
            }).then(refresh);
          }}
        >
          <input className="rounded-lg border border-line px-3 py-2" name="day" type="date" required />
          <input className="rounded-lg border border-line px-3 py-2" name="countedCashFcfa" placeholder="Counted cash" required />
          <button className="rounded-lg bg-purple px-4 py-2 text-white" type="submit">
            Close cash-up
          </button>
        </form>
        <form
          className="mt-3 flex flex-wrap gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            void apiSend("/api/v1/period-locks", "POST", { kind: "month", key: form.get("month") }).then(refresh);
          }}
        >
          <input className="rounded-lg border border-line px-3 py-2" name="month" placeholder="2026-11" required />
          <button className="rounded-lg bg-purple px-4 py-2 text-white" type="submit">
            Lock month
          </button>
        </form>
      </article>
    </div>
  );
}
