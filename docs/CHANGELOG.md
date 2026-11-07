# Changelog

## 0.8.4 — Demo fill and reset

- Super Admin can fill the system with fictional demo data from System health (`LOAD DEMO DATA`).
- Reset removes that demo data (`RESET DEMO DATA`) and leaves the school profile ready for official use.
- Demo role accounts (`demo.bursar`, and the other `demo.*` users) use password `DemoPass123` and are deleted on reset.

## 0.8.3 — Change school type after setup

- Headteachers and Super Admins can change primary / secondary / combined on School structure.
- Missing classes for the new type are added; unused empty sections from the other cycle are hidden, not deleted.

## 0.8.2 — School kind at setup

- Setup asks whether the school is primary, secondary, or nursery through secondary.
- The first academic year creates only the matching classes (Class 1–6 vs Form 1–Upper Sixth).

## 0.8.1 — Usable home screen and chrome

- Today’s activity is written as full sentences (who did what, in school language).
- Home dashboard: colourful stat cards, fee bar chart, enrolment pie, attendance bars.
- Collapsible sidebar with white line icons; phone drawer menu; school name in the header; footer “Powered by Promptstack Technologies”.
- Brand purple `#BF00FF`.

## 0.8.0 — Phase 8 Packaging and handover

- Offline installer: bundled image tar, Compose on ProgramData, firewall TCP 3847, boot task, desktop shortcut.
- Upgrade script loads a new image without wiping data; app writes a pre-migration backup when `schema.version` changes.
- System health shows LAN URL, QR code, and Docker runtime. Production first admin must change password.
- Install, upgrade, user, and clean-VM docs.

## 0.7.0 — Phase 7 Backup, restore, hardening

- Manual and scheduled `.sms-backup` archives via the SQLite backup API, checksum + integrity_check, last-N retention.
- Restore wizard with `RESTORE SCHOOL DATA`, automatic safety backup, path-safe unpack.
- Health page: last backup, 48-hour stale warning, disk free, integrity, Drive queue (off by default).
- Audit log SQLite immutability triggers, request ids, OpenAPI stub, indexes and a 5,000-pupil list timing check.

## 0.6.0 — Phase 6 Reports, inventory, admin

- Report catalogue with on-screen table, print, PDF, and Excel (UTF-8 CSV); extra permission checks (payroll, audit, fees).
- Inventory items with stock in/out movements, derived quantity, low-stock flag.
- School calendar, role-filtered announcements, letter templates with merge fields.
- Global search (Ctrl+K) for pupils, staff, and receipts.
- Role dashboards: management stats, bursar collections, teacher class tasks, secretary admissions queue.

## 0.5.0 — Phase 5 Academics and attendance

- Assessment types, mark grids, submit-to-lock, Headteacher unlock.
- Shared grading engine: weighted averages, competition ranks (min rank), missing marks excluded unless setting treats them as zero.
- Term result snapshots and printable report cards (withhold if fees outstanding is off by default).
- Pupil attendance register; teachers scoped to staff assignments.

## 0.4.0 — Phase 4 Staff, payroll, expenses

- Staff directory with restricted national ID, status history, assignments, leave, attendance.
- Salary structures (fixed and percent components), advances, monthly payroll run with maker-checker, payslip PDF.
- Expenses: categories, budgets with over-budget warning, draft → submitted → approved → paid.

## 0.3.0 — Phase 3 Fees and payments

- Fee items, auto-invoice on enrolment, integer FCFA ledgers, oldest-first allocation.
- Payments with receipt numbers `RC-00001`, printable PDF, idempotency keys, duplicate-day confirmation.
- Discounts above FCFA 10,000 and payment reversals require a second approver (maker cannot approve self).
- Arrears list, reminder text, cash-up close, month period locks, finance dashboard.

## 0.2.1 — Empty JSON POST bodies

- Accept `Content-Type: application/json` with an empty body (Finish setup, Sign out, audit verify). The browser client now sends `{}` on those calls.

## 0.2.0 — Phase 2 Structure and pupils

- Academic tree: years/terms, sections/levels, classes with streams, subjects, default grading scales.
- Admissions workflow: applied → under review → accepted → enrolled (or rejected / waitlisted).
- Pupils, guardians (reuse by phone), enrolment, admission numbers `ABC-{YEAR}-{SEQ:4}`.
- Directory search (name, admission number, guardian phone), pupil timeline, CSV import with dry-run.
- Bulk promote with 48-hour undo.

## 0.1.0 — Phase 1 Foundation

- Monorepo: `apps/server`, `apps/web`, `packages/shared`.
- SQLite + Drizzle schema for users, roles, sessions, audit, settings, sequences, school profile, years/terms/sections/levels.
- Auth: argon2, HTTP-only sessions, CSRF, lockout, first-login password change.
- RBAC with default Cameroon school roles; server-side enforcement.
- Audit log hash chain and verify endpoint.
- First-run wizard UI.
- Purple/white app shell.
- Docker Compose as the production runtime.
