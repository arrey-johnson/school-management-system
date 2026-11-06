import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { apiGet, apiSend } from "../lib/api";
import { useAuth } from "./AuthProvider";

const links: { to: string; labelKey: string; end?: boolean; perm: string | null }[] = [
  { to: "/", labelKey: "nav.overview", end: true, perm: null },
  { to: "/structure", labelKey: "nav.structure", perm: "academic:read" },
  { to: "/admissions", labelKey: "nav.admissions", perm: "admissions:read" },
  { to: "/pupils", labelKey: "nav.pupils", perm: "pupils:read" },
  { to: "/fees", labelKey: "nav.fees", perm: "payments:read" },
  { to: "/staff", labelKey: "nav.staff", perm: "staff:read" },
  { to: "/payroll", labelKey: "nav.payroll", perm: "payroll:view" },
  { to: "/expenses", labelKey: "nav.expenses", perm: "expenses:read" },
  { to: "/academics", labelKey: "nav.academics", perm: "academics:read" },
  { to: "/attendance", labelKey: "nav.attendance", perm: "attendance:read" },
  { to: "/reports", labelKey: "nav.reports", perm: "reports:read" },
  { to: "/admin", labelKey: "nav.inventory", perm: "inventory:read" },
  { to: "/users", labelKey: "nav.settings", perm: "system:users" },
  { to: "/audit", labelKey: "nav.audit", perm: "system:audit" },
  { to: "/settings", labelKey: "nav.health", perm: "system:health" },
];

type Hit = { type: string; id: string; label: string; hint: string; href: string };

export function AppShell() {
  const { t } = useTranslation();
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);

  const can = (perm: string | null) =>
    !perm || user?.roleSlug === "super_admin" || user?.permissions.includes(perm);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
      if (event.key === "Escape") setSearchOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!searchOpen || query.trim().length < 2) {
      setHits([]);
      return;
    }
    const handle = window.setTimeout(() => {
      void apiGet<{ items: Hit[] }>(`/api/v1/search?q=${encodeURIComponent(query.trim())}`)
        .then((res) => setHits(res.items))
        .catch(() => setHits([]));
    }, 200);
    return () => window.clearTimeout(handle);
  }, [query, searchOpen]);

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-64 flex-col bg-deep text-white">
        <div className="border-b border-white/10 px-5 py-6">
          <p className="text-xs uppercase tracking-wide text-soft">Promptstack</p>
          <h1 className="mt-1 text-lg font-semibold leading-tight">{t("appName")}</h1>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {links
            .filter((link) => can(link.perm))
            .map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                className={({ isActive }) =>
                  `block rounded-lg px-3 py-2 text-sm ${isActive ? "bg-white/15" : "hover:bg-white/10"}`
                }
              >
                {t(link.labelKey)}
              </NavLink>
            ))}
        </nav>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-line bg-white px-6 py-3">
          <p className="text-sm text-muted">{user?.roleName}</p>
          <div className="flex items-center gap-3">
            <button
              className="rounded-lg border border-line px-3 py-1.5 text-sm text-muted"
              type="button"
              onClick={() => setSearchOpen(true)}
            >
              Search (Ctrl+K)
            </button>
            <span className="text-sm font-medium">{user?.displayName}</span>
            <button
              className="rounded-lg border border-line px-3 py-1.5 text-sm"
              type="button"
              onClick={() => {
                void apiSend("/api/v1/auth/logout", "POST").then(() => {
                  setUser(null);
                  navigate("/login");
                });
              }}
            >
              {t("common.signOut")}
            </button>
          </div>
        </header>
        <main className="flex-1 bg-pale p-6">
          <Outlet />
        </main>
      </div>
      {searchOpen ? (
        <div className="fixed inset-0 z-20 flex items-start justify-center bg-ink/40 p-10" role="dialog" aria-label="Search">
          <div className="w-full max-w-xl rounded-card bg-white p-4 shadow-card">
            <input
              autoFocus
              className="w-full rounded-lg border border-line px-3 py-2"
              placeholder="Pupils, staff, receipts"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <ul className="mt-3 max-h-80 overflow-auto text-sm">
              {hits.map((hit) => (
                <li key={`${hit.type}-${hit.id}`}>
                  <button
                    className="w-full rounded-lg px-3 py-2 text-left hover:bg-pale"
                    type="button"
                    onClick={() => {
                      setSearchOpen(false);
                      setQuery("");
                      navigate(hit.href);
                    }}
                  >
                    <span className="font-medium">{hit.label}</span>
                    <span className="ml-2 text-muted">
                      {hit.type} {hit.hint}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <button className="mt-2 text-sm text-muted" type="button" onClick={() => setSearchOpen(false)}>
              Close
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
