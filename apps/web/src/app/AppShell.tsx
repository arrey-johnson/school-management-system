import { POWERED_BY } from "@sms/shared";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  IconAcademics,
  IconChevron,
  IconFinance,
  IconFrontDesk,
  IconMenu,
  IconOffice,
  IconOverview,
  NAV_ICONS,
} from "../components/NavIcons";
import { apiGet, apiSend } from "../lib/api";
import { useAuth } from "./AuthProvider";

type NavItem = {
  to: string;
  labelKey: string;
  end?: boolean;
  perm: string | null;
  icon: keyof typeof NAV_ICONS;
};

type GroupId = "frontDesk" | "classrooms" | "finance" | "admin";

const homeLink: NavItem = { to: "/", labelKey: "nav.home", end: true, perm: null, icon: "overview" };

const groups: {
  id: GroupId;
  labelKey: string;
  Icon: typeof IconFrontDesk;
  items: NavItem[];
}[] = [
  {
    id: "frontDesk",
    labelKey: "nav.group.frontDesk",
    Icon: IconFrontDesk,
    items: [
      { to: "/admissions", labelKey: "nav.admissions", perm: "admissions:read", icon: "admissions" },
      { to: "/pupils", labelKey: "nav.pupils", perm: "pupils:read", icon: "pupils" },
    ],
  },
  {
    id: "classrooms",
    labelKey: "nav.group.classrooms",
    Icon: IconAcademics,
    items: [
      { to: "/structure", labelKey: "nav.structure", perm: "academic:read", icon: "structure" },
      { to: "/academics", labelKey: "nav.academics", perm: "academics:read", icon: "academics" },
      { to: "/attendance", labelKey: "nav.attendance", perm: "attendance:read", icon: "attendance" },
      { to: "/reports", labelKey: "nav.reports", perm: "reports:read", icon: "reports" },
    ],
  },
  {
    id: "finance",
    labelKey: "nav.group.finance",
    Icon: IconFinance,
    items: [
      { to: "/fees", labelKey: "nav.fees", perm: "payments:read", icon: "fees" },
      { to: "/expenses", labelKey: "nav.expenses", perm: "expenses:read", icon: "expenses" },
      { to: "/payroll", labelKey: "nav.payroll", perm: "payroll:view", icon: "payroll" },
    ],
  },
  {
    id: "admin",
    labelKey: "nav.group.admin",
    Icon: IconOffice,
    items: [
      { to: "/staff", labelKey: "nav.staff", perm: "staff:read", icon: "staff" },
      { to: "/admin", labelKey: "nav.inventory", perm: "inventory:read", icon: "inventory" },
      { to: "/users", labelKey: "nav.users", perm: "system:users", icon: "settings" },
      { to: "/audit", labelKey: "nav.audit", perm: "system:audit", icon: "audit" },
      { to: "/settings", labelKey: "nav.health", perm: "system:health", icon: "health" },
    ],
  },
];

function groupForPath(pathname: string): GroupId | null {
  for (const group of groups) {
    if (group.items.some((item) => pathname === item.to || pathname.startsWith(`${item.to}/`))) {
      return group.id;
    }
  }
  return null;
}

function NavItemLink({
  item,
  collapsed,
  nested,
  label,
}: {
  item: NavItem;
  collapsed: boolean;
  nested?: boolean;
  label: string;
}) {
  const Icon = NAV_ICONS[item.icon];
  return (
    <NavLink
      to={item.to}
      end={item.end}
      title={label}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-xl py-2.5 text-sm text-white/95 ${
          nested ? "px-3 pl-11" : "px-3"
        } ${isActive ? "bg-white/20 shadow-sm" : "hover:bg-white/10"} ${collapsed ? "justify-center px-2" : ""}`
      }
    >
      <Icon className="h-5 w-5 shrink-0 text-white/90" />
      <span className={collapsed ? "sr-only" : "truncate"}>{label}</span>
    </NavLink>
  );
}

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
  const [openGroup, setOpenGroup] = useState<GroupId | null>(() => {
    const saved = localStorage.getItem("sms.navGroup");
    if (saved === "frontDesk" || saved === "classrooms" || saved === "finance" || saved === "admin") {
      return saved;
    }
    return null;
  });

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
    const match = groupForPath(location.pathname);
    if (match) setOpenGroup(match);
  }, [location.pathname]);

  useEffect(() => {
    localStorage.setItem("sms.navCollapsed", collapsed ? "1" : "0");
  }, [collapsed]);

  useEffect(() => {
    if (openGroup) localStorage.setItem("sms.navGroup", openGroup);
  }, [openGroup]);

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
      <div className={`shrink-0 border-b border-white/15 ${collapsed ? "px-3 py-4" : "px-4 py-4"}`}>
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/70">School</p>
        <h1 className={`mt-1 font-semibold leading-tight text-white ${collapsed ? "sr-only" : "text-base"}`}>
          {schoolName}
        </h1>
      </div>
      <nav className="min-h-0 flex-1 space-y-1 overflow-hidden p-2">
        <NavItemLink item={homeLink} collapsed={collapsed} label={t(homeLink.labelKey)} />
        {groups.map((group) => {
          const visible = group.items.filter((item) => can(item.perm));
          if (visible.length === 0) return null;
          const label = t(group.labelKey);
          const opened = openGroup === group.id;
          const GroupIcon = group.Icon;
          return (
            <div key={group.id}>
              <button
                type="button"
                title={label}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-white/95 hover:bg-white/10 ${
                  collapsed ? "justify-center px-2" : ""
                }`}
                onClick={() => {
                  if (collapsed) {
                    setCollapsed(false);
                    setOpenGroup(group.id);
                    return;
                  }
                  setOpenGroup((current) => (current === group.id ? null : group.id));
                }}
              >
                <GroupIcon className="h-5 w-5 shrink-0 text-white/90" />
                <span className={collapsed ? "sr-only" : "min-w-0 flex-1 truncate font-medium"}>{label}</span>
                {collapsed ? null : (
                  <IconChevron className={`h-4 w-4 shrink-0 text-white/70 ${opened ? "rotate-180" : ""}`} />
                )}
              </button>
              {!collapsed && opened
                ? visible.map((item) => (
                    <NavItemLink
                      key={item.to}
                      item={item}
                      collapsed={false}
                      nested
                      label={t(item.labelKey)}
                    />
                  ))
                : null}
            </div>
          );
        })}
      </nav>
    </>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-pale">
      {mobileOpen ? (
        <button
          className="fixed inset-0 z-30 bg-ink/40 md:hidden"
          type="button"
          aria-label="Close menu"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex h-screen flex-col overflow-hidden bg-deep text-white shadow-xl transition-all md:static md:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        } ${collapsed ? "w-[4.5rem]" : "w-64"}`}
      >
        {nav}
      </aside>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <header className="z-20 flex shrink-0 items-center justify-between gap-3 border-b border-line bg-white/95 px-3 py-3 backdrop-blur md:px-6">
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
        <main className="min-h-0 flex-1 overflow-auto bg-pale p-4 md:p-6">
          <Outlet />
        </main>
        <footer className="shrink-0 border-t border-line bg-white px-4 py-3 text-center text-xs text-muted md:px-6">
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
