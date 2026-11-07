import type { ReactNode } from "react";

type IconProps = { className?: string };

function Svg({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <svg
      className={className ?? "h-5 w-5 shrink-0"}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  );
}

export function IconOverview(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </Svg>
  );
}
export function IconStructure(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 3v6" />
      <circle cx="12" cy="3" r="2" />
      <path d="M6 21v-6h12v6" />
      <path d="M6 15V12h12v3" />
    </Svg>
  );
}
export function IconAdmissions(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M8 7h8M8 11h5" />
      <path d="M6 4h12a2 2 0 0 1 2 2v14l-4-2-4 2-4-2-4 2V6a2 2 0 0 1 2-2z" />
    </Svg>
  );
}
export function IconPupils(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20c1-4 4-6 6-6s5 2 6 6" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M16 20c.4-2 1.5-3.5 3-4" />
    </Svg>
  );
}
export function IconFees(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="M3 10h18" />
      <circle cx="16" cy="14" r="1.2" />
    </Svg>
  );
}
export function IconStaff(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="8" r="3" />
      <path d="M5 20c1.5-4 4-6 7-6s5.5 2 7 6" />
    </Svg>
  );
}
export function IconPayroll(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 3v18" />
      <path d="M8 8h5.5a2.5 2.5 0 0 1 0 5H9a2.5 2.5 0 0 0 0 5H16" />
    </Svg>
  );
}
export function IconExpenses(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 7h16v12H4z" />
      <path d="M8 7V5h8v2" />
      <path d="M8 12h8M8 16h5" />
    </Svg>
  );
}
export function IconAcademics(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3 7 12 3l9 4-9 4-9-4z" />
      <path d="M7 10v5c2 2 8 2 10 0v-5" />
    </Svg>
  );
}
export function IconAttendance(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4" y="5" width="16" height="15" rx="2" />
      <path d="M8 3v4M16 3v4M4 10h16" />
      <path d="M8 15l2 2 4-4" />
    </Svg>
  );
}
export function IconReports(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M5 19V9" />
      <path d="M10 19V5" />
      <path d="M15 19v-7" />
      <path d="M20 19v-4" />
    </Svg>
  );
}
export function IconStore(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 9h16l-1 11H5L4 9z" />
      <path d="M8 9V7a4 4 0 0 1 8 0v2" />
    </Svg>
  );
}
export function IconUsers(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="9" cy="8" r="3" />
      <circle cx="16" cy="9" r="2.2" />
      <path d="M3 20c1-4 3.5-6 6-6s5 2 6 6" />
    </Svg>
  );
}
export function IconAudit(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M8 6h11M8 12h11M8 18h7" />
      <circle cx="4" cy="6" r="1" />
      <circle cx="4" cy="12" r="1" />
      <circle cx="4" cy="18" r="1" />
    </Svg>
  );
}
export function IconHealth(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 21s-7-4.5-7-10a4 4 0 0 1 7-2 4 4 0 0 1 7 2c0 5.5-7 10-7 10z" />
    </Svg>
  );
}
export function IconMenu(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </Svg>
  );
}
export function IconCollapse(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M15 6 9 12l6 6" />
    </Svg>
  );
}
export function IconChevron(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6 9l6 6 6-6" />
    </Svg>
  );
}
export function IconFrontDesk(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 20V10l8-5 8 5v10" />
      <path d="M10 20v-6h4v6" />
    </Svg>
  );
}
export function IconFinance(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v8M9.5 10.5c.6-1 1.5-1.5 2.5-1.5h1a2 2 0 0 1 0 4h-2a2 2 0 0 0 0 4h1c1 0 1.9-.5 2.5-1.5" />
    </Svg>
  );
}
export function IconOffice(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 20V7l8-3 8 3v13" />
      <path d="M9 20v-5h6v5M9 10h.01M15 10h.01M12 10h.01M9 14h.01M15 14h.01M12 14h.01" />
    </Svg>
  );
}

export const NAV_ICONS = {
  overview: IconOverview,
  structure: IconStructure,
  admissions: IconAdmissions,
  pupils: IconPupils,
  fees: IconFees,
  staff: IconStaff,
  payroll: IconPayroll,
  expenses: IconExpenses,
  academics: IconAcademics,
  attendance: IconAttendance,
  reports: IconReports,
  inventory: IconStore,
  settings: IconUsers,
  audit: IconAudit,
  health: IconHealth,
} as const;
