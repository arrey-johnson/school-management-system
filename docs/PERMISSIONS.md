# Permissions

Permissions are `resource:action` strings. Super Admin bypasses checks. Other roles use the grants in `packages/shared/src/permissions.ts`.

| Role | Notes |
|---|---|
| Super Admin | All permissions |
| Proprietor | Read-only overview, reports, inventory read, audit, approve payments/payroll/expenses |
| Headteacher | Academic structure and results; calendar/announcements (`school:update`); inventory; no `payroll:view` |
| Bursar | Fees, payments, expenses, `payroll:view`; cannot approve own reversals |
| Secretary | Admissions and pupil records; reports read |
| Teacher | Own class/subject scope for marks and attendance; search pupils/staff only |
| HR | Staff and payroll preparation |

Sensitive: `pupils:medical`, `staff:national_id`, `payroll:view`. Report exports also need `reports:export` plus the module permission (e.g. payroll report needs `payroll:view`).
