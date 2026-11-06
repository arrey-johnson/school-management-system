# Permissions (Phase 1)

Permissions are `resource:action` strings. Super Admin bypasses checks. Other roles use the grants in `packages/shared/src/permissions.ts`.

| Role | Notes |
|---|---|
| Super Admin | All permissions |
| Proprietor | Read-only overview, reports, audit, approve payments |
| Headteacher | Academic structure and results; no `payroll:view` |
| Bursar | Fees, payments, expenses, `payroll:view`; cannot approve own reversals |
| Secretary | Admissions and pupil records |
| Teacher | Own class/subject scope (enforced more fully in later phases) |
| HR | Staff and payroll preparation |

Sensitive: `pupils:medical`, `staff:national_id`, `payroll:view`.
