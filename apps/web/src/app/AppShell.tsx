import { useTranslation } from "react-i18next";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { apiSend } from "../lib/api";
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
  { to: "/users", labelKey: "nav.settings", perm: "system:users" },
  { to: "/audit", labelKey: "nav.audit", perm: "system:audit" },
  { to: "/settings", labelKey: "nav.health", perm: "system:health" },
];

export function AppShell() {
  const { t } = useTranslation();
  const { user, setUser } = useAuth();
  const navigate = useNavigate();

  const can = (perm: string | null) =>
    !perm || user?.roleSlug === "super_admin" || user?.permissions.includes(perm);

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
    </div>
  );
}
