import { formatFcfa } from "@sms/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useAuth } from "../../app/AuthProvider";
import { apiGet, apiSend } from "../../lib/api";

type Item = {
  id: string;
  sku: string;
  name: string;
  category: string;
  location: string;
  quantity: number;
  minQty: number;
  lowStock: boolean;
  costFcfa: number;
};
type EventRow = { id: string; title: string; kind: string; startDate: string; endDate: string };
type Note = { id: string; title: string; body: string; audience: string };
type Template = { id: string; name: string; body: string };
type Pupil = { id: string; givenName: string; familyName: string };

export function InventoryAdminPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [rendered, setRendered] = useState<string | null>(null);
  const canStock = user?.roleSlug === "super_admin" || user?.permissions.includes("inventory:manage");
  const canAdmin = user?.roleSlug === "super_admin" || user?.permissions.includes("school:update");
  const canInventory = user?.roleSlug === "super_admin" || user?.permissions.includes("inventory:read");

  const stock = useQuery({
    queryKey: ["inventory"],
    queryFn: () => apiGet<{ items: Item[] }>("/api/v1/inventory"),
    enabled: Boolean(canInventory),
  });
  const events = useQuery({ queryKey: ["calendar"], queryFn: () => apiGet<{ items: EventRow[] }>("/api/v1/calendar") });
  const notes = useQuery({ queryKey: ["announcements"], queryFn: () => apiGet<{ items: Note[] }>("/api/v1/announcements") });
  const templates = useQuery({ queryKey: ["templates"], queryFn: () => apiGet<{ items: Template[] }>("/api/v1/templates") });
  const canPupils = user?.roleSlug === "super_admin" || user?.permissions.includes("pupils:read");
  const pupils = useQuery({
    queryKey: ["pupils-mini"],
    queryFn: () => apiGet<{ items: Pupil[] }>("/api/v1/pupils"),
    enabled: Boolean(canPupils),
  });
  const refresh = () => void queryClient.invalidateQueries();
  const fail = (err: unknown) => setError(err instanceof Error ? err.message : "Failed");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-deep">Inventory and administration</h1>
      {error ? <p className="text-sm text-danger">{error}</p> : null}

      {canInventory ? (
        <section className="space-y-3 rounded-card border border-line bg-white p-5 shadow-card">
          <h2 className="font-semibold text-deep">Stock (quantity from movements only)</h2>
          {canStock ? (
            <form
              className="grid gap-3 md:grid-cols-4"
              onSubmit={(e) => {
                e.preventDefault();
                const form = new FormData(e.currentTarget);
                setError(null);
                void apiSend("/api/v1/inventory", "POST", {
                  sku: form.get("sku"),
                  name: form.get("name"),
                  category: form.get("category"),
                  location: form.get("location"),
                  condition: "good",
                  acquiredOn: form.get("acquiredOn"),
                  costFcfa: Number(form.get("costFcfa")),
                  minQty: Number(form.get("minQty")),
                })
                  .then(refresh)
                  .catch(fail);
              }}
            >
              <input className="rounded-lg border border-line px-3 py-2" name="sku" placeholder="SKU" required />
              <input className="rounded-lg border border-line px-3 py-2" name="name" placeholder="Name" required />
              <input className="rounded-lg border border-line px-3 py-2" name="category" placeholder="Category" required />
              <input className="rounded-lg border border-line px-3 py-2" name="location" placeholder="Location" required />
              <input className="rounded-lg border border-line px-3 py-2" name="acquiredOn" type="date" required />
              <input className="rounded-lg border border-line px-3 py-2" name="costFcfa" type="number" min={0} placeholder="Cost FCFA" required />
              <input className="rounded-lg border border-line px-3 py-2" name="minQty" type="number" min={0} defaultValue={1} />
              <button className="rounded-lg bg-purple px-4 py-2 text-white" type="submit">
                Add item
              </button>
            </form>
          ) : null}
          <ul className="space-y-2 text-sm">
            {(stock.data?.items ?? []).map((item) => (
              <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-line py-2">
                <span>
                  {item.sku} {item.name} — qty {item.quantity} {item.lowStock ? "(low)" : ""} — {formatFcfa(item.costFcfa)}
                </span>
                {canStock ? (
                  <form
                    className="flex gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const form = new FormData(e.currentTarget);
                      setError(null);
                      void apiSend("/api/v1/inventory/movements", "POST", {
                        itemId: item.id,
                        direction: form.get("direction"),
                        quantity: Number(form.get("quantity")),
                        reason: form.get("reason"),
                      })
                        .then(refresh)
                        .catch(fail);
                    }}
                  >
                    <select className="rounded-lg border border-line px-2 py-1" name="direction">
                      <option value="in">In</option>
                      <option value="out">Out</option>
                    </select>
                    <input className="w-20 rounded-lg border border-line px-2 py-1" name="quantity" type="number" min={1} defaultValue={1} />
                    <input className="rounded-lg border border-line px-2 py-1" name="reason" placeholder="Reason" required />
                    <button className="rounded-lg border border-line px-3 py-1" type="submit">
                      Record
                    </button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-card border border-line bg-white p-5 shadow-card">
          <h2 className="font-semibold text-deep">Calendar</h2>
          {canAdmin ? (
            <form
              className="mt-3 grid gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const form = new FormData(e.currentTarget);
                setError(null);
                void apiSend("/api/v1/calendar", "POST", {
                  title: form.get("title"),
                  kind: form.get("kind"),
                  startDate: form.get("startDate"),
                  endDate: form.get("endDate"),
                })
                  .then(refresh)
                  .catch(fail);
              }}
            >
              <input className="rounded-lg border border-line px-3 py-2" name="title" placeholder="Title" required />
              <select className="rounded-lg border border-line px-3 py-2" name="kind">
                <option value="event">Event</option>
                <option value="holiday">Holiday</option>
                <option value="term">Term</option>
              </select>
              <input className="rounded-lg border border-line px-3 py-2" name="startDate" type="date" required />
              <input className="rounded-lg border border-line px-3 py-2" name="endDate" type="date" required />
              <button className="rounded-lg bg-purple px-4 py-2 text-white" type="submit">
                Add event
              </button>
            </form>
          ) : null}
          <ul className="mt-3 space-y-1 text-sm">
            {(events.data?.items ?? []).map((row) => (
              <li key={row.id}>
                {row.startDate} {row.title} ({row.kind})
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-card border border-line bg-white p-5 shadow-card">
          <h2 className="font-semibold text-deep">Announcements</h2>
          {canAdmin ? (
            <form
              className="mt-3 grid gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const form = new FormData(e.currentTarget);
                setError(null);
                void apiSend("/api/v1/announcements", "POST", {
                  title: form.get("title"),
                  body: form.get("body"),
                  audience: form.get("audience") || "all",
                  expiresOn: form.get("expiresOn") || undefined,
                })
                  .then(refresh)
                  .catch(fail);
              }}
            >
              <input className="rounded-lg border border-line px-3 py-2" name="title" placeholder="Title" required />
              <textarea className="rounded-lg border border-line px-3 py-2" name="body" placeholder="Message" required />
              <input className="rounded-lg border border-line px-3 py-2" name="audience" placeholder="all, teacher, bursar…" defaultValue="all" />
              <input className="rounded-lg border border-line px-3 py-2" name="expiresOn" type="date" />
              <button className="rounded-lg bg-purple px-4 py-2 text-white" type="submit">
                Post
              </button>
            </form>
          ) : null}
          <ul className="mt-3 space-y-2 text-sm">
            {(notes.data?.items ?? []).map((row) => (
              <li key={row.id}>
                <strong>{row.title}</strong> — {row.body}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="rounded-card border border-line bg-white p-5 shadow-card">
        <h2 className="font-semibold text-deep">Letter templates</h2>
        <p className="text-sm text-muted">Merge fields: {"{{school.name}} {{pupil.givenName}} {{pupil.familyName}} {{pupil.admissionNumber}} {{today}}"}</p>
        {canAdmin ? (
          <form
            className="mt-3 grid gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              setError(null);
              void apiSend("/api/v1/templates", "POST", { name: form.get("name"), body: form.get("body") })
                .then(refresh)
                .catch(fail);
            }}
          >
            <input className="rounded-lg border border-line px-3 py-2" name="name" placeholder="Template name" required />
            <textarea className="min-h-24 rounded-lg border border-line px-3 py-2" name="body" required />
            <button className="rounded-lg bg-purple px-4 py-2 text-white" type="submit">
              Save template
            </button>
          </form>
        ) : null}
        <form
          className="mt-4 flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            setError(null);
            void apiSend<{ text: string }>(`/api/v1/templates/${String(form.get("templateId"))}/render`, "POST", {
              pupilId: form.get("pupilId"),
            })
              .then((res) => setRendered(res.text))
              .catch(fail);
          }}
        >
          <select className="rounded-lg border border-line px-3 py-2" name="templateId" required>
            <option value="">Template</option>
            {(templates.data?.items ?? []).map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}
              </option>
            ))}
          </select>
          <select className="rounded-lg border border-line px-3 py-2" name="pupilId">
            <option value="">Pupil (optional)</option>
            {(pupils.data?.items ?? []).map((row) => (
              <option key={row.id} value={row.id}>
                {row.givenName} {row.familyName}
              </option>
            ))}
          </select>
          <button className="rounded-lg border border-line px-4 py-2" type="submit">
            Merge
          </button>
        </form>
        {rendered ? <pre className="mt-3 whitespace-pre-wrap rounded-lg bg-pale p-3 text-sm">{rendered}</pre> : null}
      </section>
    </div>
  );
}
