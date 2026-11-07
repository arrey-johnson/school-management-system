import { POWERED_BY } from "@sms/shared";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { IconMenu, NAV_ICONS } from "../components/NavIcons";
import { apiGet, apiSend } from "../lib/api";
import { useAuth } from "./AuthProvider";

const links: {
  to: string;
  labelKey: string;
  end?: boolean;
  perm: string | null;
  icon: keyof typeof NAV_ICONS;
}[] = [
  { to: "/", labelKey: "nav.overview", end: true, perm: null, icon: "overview" },
  { to: "/structure", labelKey: "nav.structure", perm: "academic:read", icon: "structure" },
  { to: "/admissions", labelKey: "nav.admissions", perm: "admissions:read", icon: "admissions" },
  { to: "/pupils", labelKey: "nav.pupils", perm: "pupils:read", icon: "pupils" },
  { to: "/fees", labelKey: "nav.fees", perm: "payments:read", icon: "fees" },
  { to: "/staff", labelKey: "nav.staff", perm: "staff:read", icon: "staff" },
  { to: "/payroll", labelKey: "nav.payroll", perm: "payroll:view", icon: "payroll" },
  { to: "/expenses", labelKey: "nav.expenses", perm: "expenses:read", icon: "expenses" },
  { to: "/academics", labelKey: "nav.academics", perm: "academics:read", icon: "academics" },
  { to: "/attendance", labelKey: "nav.attendance", perm: "attendance:read", icon: "attendance" },
  { to: "/reports", labelKey: "nav.reports", perm: "reports:read", icon: "reports" },
  { to: "/admin", labelKey: "nav.inventory", perm: "inventory:read", icon: "inventory" },
  { to: "/users", labelKey: "nav.settings", perm: "system:users", icon: "settings" },
  { to: "/audit", labelKey: "nav.audit", perm: "system:audit", icon: "audit" },
  { to: "/settings", labelKey: "nav.health", perm: "system:health", icon: "health" },
];

type Hit = { type: string; id: string; label: string; hint: string; href: string };

export function AppShell() {
  const { t } = useTranslation();
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem("sms.navCollapsed") === "1");
  const [mobileOpen, setMobileOpen] = useState(false);

  const branding = useQuery({
    queryKey: ["branding"],
    queryFn: () => apiGet<{ schoolName: string | null }>("/api/v1/branding"),
  });
  const schoolName = branding.data?.schoolName ?? t("appName");

  const can = (perm: string | null) =>
    !perm || user?.roleSlug === "super_admin" || user?.permissions.includes(perm);

  useEffect(() => {
    document.title = schoolName;
  }, [schoolName]);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    localStorage.setItem("sms.navCollapsed", collapsed ? "1" : "0");
  }, [collapsed]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
      if (event.key === "Escape") {
        setSearchOpen(false);
        setMobileOpen(false);
      }
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

  const toggleMenu = () => {
    if (window.matchMedia("(min-width: 768px)").matches) {
      setCollapsed((v) => !v);
      return;
    }
    setMobileOpen((v) => !v);
  };

  const nav = (
    <>
      <div className={`border-b border-white/15 ${collapsed ? "px-3 py-4" : "px-4 py-4"}`}>
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/70">School</p>
        <h1 className={`mt-1 font-semibold leading-tight text-white ${collapsed ? "sr-only" : "text-base"}`}>
          {schoolName}
        </h1>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-2">
        {links
          .filter((link) => can(link.perm))
          .map((link) => {
            const Icon = NAV_ICONS[link.icon];
            const label = t(link.labelKey);
            return (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                title={label}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-white/95 ${
                    isActive ? "bg-white/20 shadow-sm" : "hover:bg-white/10"
                  } ${collapsed ? "justify-center px-2" : ""}`
                }
              >
                <Icon className="h-5 w-5 shrink-0 text-white/90" />
                <span className={collapsed ? "sr-only" : "truncate"}>{label}</span>
              </NavLink>
            );
          })}
      </nav>
    </>
  );

  return (
    <div className="flex min-h-screen bg-pale">
      {mobileOpen ? (
        <button
          className="fixed inset-0 z-30 bg-ink/40 md:hidden"
          type="button"
          aria-label="Close menu"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex flex-col bg-deep text-white shadow-xl transition-all md:static md:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        } ${collapsed ? "w-[4.5rem]" : "w-64"}`}
      >
        {nav}
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-line bg-white/95 px-3 py-3 backdrop-blur md:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              className="rounded-xl border border-line p-2 text-deep"
              type="button"
              aria-label="Menu"
              aria-expanded={mobileOpen || !collapsed}
              onClick={toggleMenu}
            >
              <IconMenu />
            </button>
            <div className="min-w-0">
              <p className="truncate text-base font-semibold text-deep">{schoolName}</p>
              <p className="truncate text-xs text-muted">{user?.roleName}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="hidden rounded-xl border border-line px-3 py-1.5 text-sm text-muted sm:inline"
              type="button"
              onClick={() => setSearchOpen(true)}
            >
              Search
            </button>
            <span className="hidden max-w-[9rem] truncate text-sm font-medium sm:inline">{user?.displayName}</span>
            <button
              className="rounded-xl border border-line px-3 py-1.5 text-sm"
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
        <main className="flex-1 overflow-x-auto bg-pale p-4 md:p-6">
          <Outlet />
        </main>
        <footer className="border-t border-line bg-white px-4 py-3 text-center text-xs text-muted md:px-6">
          {POWERED_BY}
        </footer>
      </div>
      {searchOpen ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-ink/40 p-4 md:p-10" role="dialog" aria-label="Search">
          <div className="w-full max-w-xl rounded-card bg-white p-4 shadow-card">
            <input
              autoFocus
              className="w-full rounded-lg border border-line px-3 py-2"
              placeholder="Find a pupil, staff member, or receipt"
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
                    <span className="ml-2 text-muted">{hit.hint}</span>
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
