# School Management System: Product Specification

## 1. Product summary

A locally installed school administration system for **ALL BRIGHT CHILDREN**, a school with nursery, primary and secondary sections (about 700 pupils, about 50 staff). It replaces paper registers, notebooks and spreadsheets with one central system covering: admissions and pupil records, classes and school structure, fees and payments, staff and HR, payroll and expenses, academics and report cards, attendance, reports and exports, inventory and administration, and users, permissions and audit.

Brand: **Promptstack Technologies** (white logo on purple at `assets/logo-white.png`). Product name shown in the UI: "Promptstack School Management".

Core principles: accuracy, traceability, simplicity for non-technical staff, works offline, easy backup and restore.

## 2. Deployment model (critical)

> **Implementation override (D031, 2026-11-06):** Production runs **only** as Docker Compose on the school server. Docker Engine must start at boot. There is no host Node process and no native-Node fallback. The installer loads a bundled image (offline) and starts Compose; NSSM may wrap Compose, not Node. LAN clients are unchanged (browser only). See `docs/DECISIONS.md` D031 and `docs/ARCHITECTURE.md`.

- One designated Windows 10/11 computer is the **server**. It hosts the app and the database.
- Other staff PCs open the app in a browser at `http://<server-name-or-ip>:<port>` on the school network. No client installation.
- Core operation never requires internet. Internet is only used for the *optional* "upload backup to Google Drive" feature, which must fail gracefully and queue/retry.
- The server app must:
  - Run as a **Windows service** (auto-start on boot, auto-restart on crash). Use `node-windows` or NSSM, scripted.
  - Provide a **one-click installer** (Inno Setup script) that installs Node runtime (bundled), the app, creates the data folder (`C:\ProgramData\PromptstackSMS\`), registers the service, opens the firewall port, and creates a desktop shortcut "Open School System".
  - Provide an **upgrade path**: new installer version migrates the database automatically (migrations run on start, with an automatic pre-migration backup).
  - Write logs to `C:\ProgramData\PromptstackSMS\logs\` with rotation.
  - Show the server's LAN URL and a QR code on a small "Server status" page for admins.

## 3. Recommended stack (use unless you find a strong reason not to; record reasons in DECISIONS.md)

- **Monorepo** with pnpm workspaces: `apps/server`, `apps/web`, `packages/shared` (Zod schemas, types, constants, permission definitions), `installer/`.
- **Server**: Node.js 20 LTS, Fastify, TypeScript, Zod, `@fastify/cookie` + secure session store, `@fastify/rate-limit`, `@fastify/helmet`.
- **Database**: SQLite via `better-sqlite3` in WAL mode, with **Drizzle ORM** and versioned migrations. Foreign keys ON. Daily integrity check (`PRAGMA integrity_check`). Rationale: single-file, trivially backed up and restored, ample for this scale.
- **Web**: React 18 + Vite + TypeScript, React Router, TanStack Query, TanStack Table, React Hook Form + Zod resolvers, Tailwind CSS with the design tokens below, Recharts for charts. Server serves the built web app as static files so only one process runs.
- **PDF**: `pdfmake` or `@react-pdf/renderer` for receipts, report cards, statements, reports. **Excel/CSV**: `exceljs`.
- **Auth**: `argon2` password hashing, HTTP-only same-site cookies, session timeout (configurable, default 30 min idle), account lockout after repeated failures, forced password change on first login, admin password reset.
- **Testing**: Vitest (unit + integration with in-memory SQLite), Playwright (e2e), ESLint, Prettier, `tsc --noEmit` in CI script.
- **i18n**: English default, structure all UI strings for French translation (`en.json`, `fr.json`), language switch per user. Ship English complete and French for navigation and common labels at minimum.

## 4. Roles and permissions

Implement role-based access control with fine-grained permissions (`resource:action`, e.g. `payments:create`, `payments:reverse`, `pupils:update`). Roles are editable by the Super Admin; ship these defaults:

| Role | Default scope |
|---|---|
| Super Admin (Promptstack/IT) | Everything, including system settings, backups, user management |
| Proprietor / Management | Read-only school-wide overview, all reports, dashboards, audit log view, approve reversals/discounts |
| Headteacher / Academic Lead | Academic structure, attendance, assessments, results, report cards, class oversight, staff directory (no salaries) |
| Accountant / Bursar | Fees, invoices, payments, receipts, expenses, payroll view, financial reports; can request reversal |
| Secretary / Admissions | Admissions, pupil records, guardians, enrolment, general administration, announcements |
| Teacher | Own assigned classes and subjects only: attendance and mark entry, class lists |
| HR / Administrator | Staff records, contracts, payroll preparation, staff attendance, settings as authorised |

Rules:
- Teachers can only see and edit data for classes/subjects assigned to them. Enforce on the server.
- Salary data visible only to roles with `payroll:view`.
- Approval workflow: reversals, discounts above a configurable threshold, and payroll finalisation require a second authorised user (maker-checker). The maker cannot approve their own request.
- Provide a permission matrix screen (roles × permissions) for the Super Admin.

## 5. Modules and detailed requirements

### 5.1 Academic structure and settings
- School profile: name, logo upload, address, phone, email, motto, stamp/signature images for documents.
- Academic years (one active at a time), terms (Cameroon default: 3 terms), term dates, holidays.
- Sections: Nursery, Primary, Secondary (add/rename allowed). Levels per section (defaults: Nursery 1-2; Primary Class 1-6; Secondary Form 1-5, Lower Sixth, Upper Sixth). Classes (with optional streams/arms, e.g. Form 1 A/B), class teacher, capacity.
- Subjects per level/class, with coefficient (weight) and which teacher teaches it in which class.
- Grading scales configurable per section (score ranges, grade letters, remarks, pass mark). Default /20 for secondary and /100 for primary, both configurable.
- Everything year-scoped so that a new year starts clean without losing history.

### 5.2 Admissions and pupils
- Admission application: applicant details, guardian details, previous school, class applied for, documents (birth certificate, report card, photo; stored on disk, referenced in DB), status workflow: Applied → Under review → Accepted → Enrolled / Rejected / Waitlisted.
- Convert an accepted application into an enrolled pupil with one click (copies data, generates admission number).
- Admission number format configurable, default `ABC-{YEAR}-{SEQ:4}`; unique, never reused.
- Pupil profile: names, sex, date of birth, place of birth, nationality, photo, address, medical notes (restricted permission), previous school, siblings link, status (Active, Suspended, Transferred, Withdrawn, Graduated), status history with dates and reasons.
- Guardians: multiple per pupil, relationship, phone numbers, email, occupation, primary-contact and fee-payer flags. Reuse a guardian across siblings.
- Enrolment per academic year: class placement, promotion/repeat/transfer actions, bulk promotion tool with preview and undo window.
- Pupil history timeline: enrolments, class changes, fees, discipline notes, status changes.
- Search by name, admission number, guardian phone, class. Duplicate detection warning (same name + DOB).
- Bulk import from Excel with downloadable template, row-level validation report, dry-run before commit.

### 5.3 Fees and payments (highest priority for correctness)
- **Fee items** (tuition, registration, books, uniform, transport, exam fees, etc.) with amount by section, level/class, term or year; optional/mandatory; installment plans.
- **Fee structure assignment**: auto-generate each pupil's fee statement (invoice) when enrolled or when a term opens; manual add/remove optional items.
- **Discounts and adjustments** (sibling discount, scholarship, waiver, late fee): require reason, user attribution, approval above threshold; shown as separate lines, never by altering the original fee.
- **Pupil fee account**: per pupil per year: total due, discounts, paid, balance, status (Paid, Partial, Unpaid, Overpaid), full ledger.
- **Payment recording**: date, amount (integer FCFA), channel (Cash, Mobile Money, Orange Money, Bank, Cheque, Other), reference/transaction ID, payer name, allocation to specific fee items (or auto-allocate oldest-first), recorded-by (auto), notes. Prevent duplicate entry via idempotency key and a warning on same pupil + amount + day.
- **Receipts**: sequential numbering (`RC-00001`, configurable prefix, no gaps, generated in a DB transaction), PDF with school header, pupil, items paid, balance after payment, payment method, cashier name, QR code containing a verification code. Reprint marks "DUPLICATE". Receipt verification page (by number) inside the system.
- **No deletes**: payments can only be **reversed** (with reason + approval), creating a negative linked entry and voiding the receipt with a visible "REVERSED" watermark. Same for adjustments.
- **Arrears**: list of pupils with outstanding balances filterable by class, section, term, minimum amount; export to Excel/PDF; printable reminder letters per guardian (template-based); optional SMS/WhatsApp message text generator (copy-to-clipboard; no external sending required).
- **Daily cash-up (Z report)**: per cashier, per day, by payment channel, with reconciliation fields (counted cash vs system), locked after close (reopening needs approval).
- **Period locking**: Management can lock a finished term/month so financial entries in it can no longer be changed except by approved adjustments dated in the open period.

### 5.4 Expenses
- Expense categories (configurable), expense entry: date, category, amount, description, vendor, payment method, attachment (receipt photo/PDF), responsible user, status (Draft → Submitted → Approved → Paid).
- Budgets per category per term/year (optional) with over-budget warnings.
- Reports: by category, by period, by user, vs budget.

### 5.5 Staff and HR
- Staff profile: names, sex, DOB, national ID number (restricted), phone, email, address, photo, qualifications, department, position, employment type, hire date, contract documents, emergency contact, status (Active, On leave, Resigned, Terminated), status history.
- Teacher assignments (class teacher, subject-class mapping).
- Leave records (type, dates, approval).
- Staff attendance (daily, with late/absent/leave) and monthly summary.
- Staff user accounts are linked to staff profiles but optional.

### 5.6 Payroll
- Salary structure per staff: base salary, recurring allowances, recurring deductions (configurable types, fixed or percentage).
- Monthly payroll run: draft → calculated → reviewed → approved (maker-checker) → paid → locked. Handles one-off bonuses, advances/loans repayment schedules, absence deductions (optional, rule-based), and configurable statutory deductions (leave rates configurable and clearly labelled as configurable, not hard-coded legal advice).
- Payslips (PDF) per staff, payroll summary and bank/Mobile Money payment list export.
- Salary changes and payroll edits are audited; finalised payroll is immutable (corrections via next-period adjustment).

### 5.7 Academics and report cards
- Assessment types per term (e.g. Sequence 1, Sequence 2, Exam, Continuous Assessment) with weights, per class/subject, and max score.
- Mark entry grid for teachers: per class/subject/assessment, keyboard-friendly (Tab/Enter), live validation (0..max), absent/excused markers, autosave drafts, submit → lock; unlocking requires Headteacher approval.
- Computation engine (pure, well-tested functions in `packages/shared`): subject averages, weighted term averages with coefficients, class rank/position (with tie handling), class average, highest/lowest, grade and remark lookup, annual average and annual rank across terms, pass/fail rules (configurable).
- **Report cards** (PDF): school header/logo, pupil info and photo, term/year, subject table (marks per assessment, subject average, coefficient, grade, teacher remark), term average, rank, class size, class average, attendance summary, conduct, class teacher and head comments, fee-clearance flag (optional rule: withhold report card if fees outstanding, configurable), signatures, QR verification. Batch generate for a whole class into one PDF. Template layout configurable per section (nursery uses descriptive/competency comments instead of marks).
- Academic reports: class performance, subject analysis, top performers, failing list, broadsheet/mark sheet (Excel + PDF).

### 5.8 Attendance
- Daily pupil attendance by class (Present, Absent, Late, Excused) with a fast tap/keyboard UI; one submission per class per day by the class teacher; edits audited.
- Absence reasons, consecutive-absence alerts on dashboard.
- Summaries: per pupil, per class, per term; percentage; printable register.
- Staff attendance covered in 5.5.

### 5.9 Reports and exports
Every report: filters, on-screen table, **Print**, **PDF**, **Excel** export, and shows who generated it and when.
Minimum set: pupil lists, class lists/registers, enrolment by class/section/sex, fee collection (daily/weekly/monthly/term), arrears, fee structure summary, payment ledger, receipts register, cash-up, expenses, income vs expenses, staff list, payroll summary, attendance, academic performance, audit log extract.

### 5.10 Inventory and administration
- Inventory: items, categories, quantity, location, condition, acquisition date, cost, stock in/out movements with reason and user (no direct quantity edits), low-stock alerts, simple asset register.
- School calendar (events, term dates, holidays), announcements (internal board by role/class, expiry date), document templates (letters) with merge fields.

### 5.11 Users, security and audit
- User management: create/disable (never delete) users, assign roles, reset passwords, force logout, view sessions, view login history.
- **Audit log**: immutable table (who, when, IP/workstation name, module, action, entity, entity id, before JSON, after JSON, reason). Viewer with filters and export. Hash-chain the audit rows (each row stores a hash of the previous row) so tampering is detectable; add an "Verify audit integrity" button.
- Security: CSRF protection, secure headers, rate limiting, input sanitisation, file-type and size validation on uploads, no directory traversal, DB file permissions restricted, passwords never logged.

### 5.12 Dashboards
- Management dashboard: total pupils (and change this term), fees collected, outstanding, collection rate, staff count, fee collection trend chart (by month), today's activity feed (admissions updated, payments recorded, attendance submitted, new staff), enrolment by section, attendance today, top arrears classes.
- Role-specific dashboards (Bursar: today's collections and arrears; Teacher: my classes, attendance to submit, marks pending; Secretary: pending admissions).

### 5.13 Backup and recovery (critical)
- **Manual backup** button: creates a timestamped `.sms-backup` archive (consistent SQLite snapshot using the SQLite backup API + uploaded files + manifest with version, checksum, counts).
- **Scheduled automatic local backup** (default daily at a configurable time; keep last N) to a configurable folder, ideally a second drive.
- **Backup validation**: after each backup, verify checksum and open the snapshot read-only to run an integrity check; show result.
- **Restore wizard**: pick archive → validate → show what will be replaced → require typing a confirmation → automatically take a safety backup first → restore → restart service. Document the procedure in `docs/BACKUP_RESTORE.md` with screenshots placeholders.
- **Optional Google Drive upload** of backups (OAuth, off by default, queued and retried when internet is available). Never required for operation.
- Backup status widget on the admin dashboard with a red warning if no successful backup in the last 48 hours.

## 6. Data model guidance

Design a normalised schema with Drizzle migrations. Use ULIDs or UUIDv7 for primary keys, `created_at`, `updated_at`, `created_by`, `updated_by` on all mutable tables, soft-delete (`archived_at`) instead of hard delete for master data, and strict foreign keys. Core entities (non-exhaustive, refine as needed):

`school_profile`, `academic_years`, `terms`, `sections`, `levels`, `classes`, `subjects`, `class_subjects`, `grading_scales`, `assessment_types`, `applications`, `pupils`, `guardians`, `pupil_guardians`, `enrolments`, `pupil_status_history`, `fee_items`, `fee_structures`, `pupil_invoices`, `invoice_lines`, `adjustments`, `payments`, `payment_allocations`, `receipts`, `reversals`, `cash_ups`, `period_locks`, `expense_categories`, `expenses`, `budgets`, `staff`, `staff_assignments`, `leaves`, `staff_attendance`, `salary_structures`, `payroll_runs`, `payroll_lines`, `payslips`, `assessments`, `marks`, `term_results`, `report_cards`, `pupil_attendance`, `inventory_items`, `stock_movements`, `events`, `announcements`, `document_templates`, `users`, `roles`, `permissions`, `role_permissions`, `sessions`, `login_attempts`, `audit_log`, `backups`, `settings`, `number_sequences`.

Key constraints:
- `number_sequences` handles admission numbers and receipt numbers atomically (transaction, no gaps for receipts).
- Money columns: `INTEGER` FCFA. Balances are **derived** from ledger entries (never stored as editable fields) or protected by transactional updates plus a verification job.
- Unique constraints on (pupil, academic year) enrolment, (class, subject, assessment, pupil) marks, etc.

## 7. API conventions
- REST under `/api/v1`, JSON, Zod-validated inputs and outputs, shared types from `packages/shared`.
- Consistent error format: `{ error: { code, message, fields? } }`. Pagination, sorting and filtering on all list endpoints (cursor or page-based, documented).
- OpenAPI doc auto-generated (`/api/docs`, admin only).
- Idempotency keys on payment creation.
- All list/report endpoints must perform well with 5,000 pupils and 100,000 transactions (add indexes, test with the seed generator).

## 8. UX requirements
- Left sidebar navigation: Overview, Pupils & Admissions, Fees & Payments, Staff & Payroll, Academics, Attendance, Reports, Inventory & Admin, Settings. Items hidden if the user lacks permission.
- Global search (Ctrl+K) for pupils, staff, receipts.
- Data tables: sortable, filterable, column visibility, saved filters, CSV/Excel export, empty states, skeleton loaders.
- Forms: inline validation, unsaved-changes warning, clear success/error toasts, confirm dialogs for destructive or financial actions.
- Fast data entry: keyboard shortcuts for payments and marks, auto-focus, sensible defaults (today's date, current term).
- Printing: dedicated print stylesheets and PDF layouts (A4) for receipts (also A5/thermal-friendly option), report cards, registers.
- Error and offline handling: friendly "server unreachable" screen with retry; no data loss on form errors.
- Accessibility: labels, focus states, contrast AA, no colour-only meaning.

## 9. Non-functional requirements
- Performance: pages interactive under 2s on a typical school PC; list queries under 300ms at target scale.
- Reliability: graceful shutdown, transactional writes, migrations tested up and with data, crash-safe SQLite (WAL, `synchronous=FULL` for financial safety).
- Security: OWASP top 10 review checklist in `docs/SECURITY.md`; dependency audit; no secrets in repo; session secret generated at install.
- Observability: structured logs, request IDs, an admin "System health" page (DB size, last backup, disk space, service uptime, version).
- Data protection: restrict access to sensitive fields (medical, national ID, salary); export actions are audited.
- Time zone: Africa/Douala; dates shown as `DD MMM YYYY`; currency shown as `FCFA 75,000`.

## 10. Seed data and demo mode
- Seed script generating realistic **fictional** data: 1 school, 1 academic year with 3 terms, all sections/levels/classes, ~700 pupils, guardians, ~50 staff, fee structure, payments and receipts, attendance, marks. Use it for tests and demos only.
- Demo accounts for every role (documented in README, disabled in production builds).
- A "Clean install" mode that creates only the Super Admin and setup wizard (first-run wizard: school profile → academic year/terms → sections/classes → subjects → fee items → users).

## 11. Design system (purple and white)

Tailwind theme tokens:
```
deep:   #24104A   (sidebar, headings on dark)
purple: #5B2FC0   (primary)
mid:    #7C4DDB   (accents, hover)
soft:   #EFE9FB   (tints, selected rows)
pale:   #F7F4FD   (page background tint)
border: #E0D6F4
ink:    #1F1237   (body text)
muted:  #6B6385   (secondary text)
success:#2E8B57   warning:#B7791F   danger:#C0392B
```
- Font: Inter (bundled locally, no CDN, since the app must work offline).
- Layout: dark purple sidebar with white logo, white top bar with breadcrumb and user menu, pale purple content area, white rounded cards (radius 12px, 1px border), purple primary buttons, green "Active/Paid" text badges, subtle shadows.
- Match the look of the approved proposal mockups: dashboard stat cards, fee collection trend line chart, "Today's activity" panel, pupil directory table with search and "+ Add pupil", fees table with receipt numbers, assessment workspace table.
- All assets (fonts, icons, images) bundled locally.

## 12. Testing and quality gates
- Unit tests (Vitest) for: money utilities, number sequences, fee generation, allocation logic, reversal logic, balance derivation, payroll calculations, grading and ranking engine (including ties), permission checks.
- Integration tests for every API route group, including permission denial cases and teacher-scope restrictions.
- E2E (Playwright) critical journeys: first-run wizard; admit and enrol a pupil; generate invoice; record payment and print receipt; reverse payment with approval; mark entry to report card; attendance submission; backup and restore round-trip; role-based access.
- Concurrency test: two users recording payments simultaneously produce unique, gap-free receipt numbers.
- Migration tests: upgrade from previous schema version with data intact.
- CI script `pnpm check` = typecheck + lint + unit + integration. Must pass before each phase is considered done.
- Coverage target: 85%+ on `packages/shared` and finance/payroll/grading code.

## 13. Documentation to produce
`README.md`, `docs/PLAN.md`, `docs/DECISIONS.md`, `docs/ARCHITECTURE.md`, `docs/DATA_MODEL.md` (ER diagram in Mermaid), `docs/PERMISSIONS.md`, `docs/BACKUP_RESTORE.md`, `docs/INSTALL_WINDOWS.md` (step-by-step for non-technical IT), `docs/USER_GUIDE.md` (per role), `docs/SECURITY.md`, `docs/CHANGELOG.md`.

## 14. Build phases (execute one at a time; stop after each for review)

**Phase 0 – Plan.** Write PLAN.md, DECISIONS.md, ARCHITECTURE.md. Scaffold monorepo, tooling, CI script, lint, formatting. No features yet.

**Phase 1 – Foundation.** Database + migrations, config, logging, auth (login, sessions, lockout, first-login password change), RBAC engine, audit log with hash chain, settings, number sequences, base UI shell (sidebar, top bar, theme), first-run wizard. Tests.

**Phase 2 – School structure and pupils.** Academic years/terms, sections/levels/classes/subjects, admissions workflow, pupils, guardians, enrolment, bulk import, search, pupil timeline. Tests.

**Phase 3 – Fees and payments.** Fee items/structures, invoices, discounts/adjustments, payments, allocation, receipts (PDF + sequencing), reversals with approval, arrears, cash-up, period locks, finance dashboard. Heaviest testing here.

**Phase 4 – Staff, payroll, expenses.** Staff, assignments, leave, staff attendance, salary structures, payroll runs with maker-checker, payslips, expenses with approval and budgets.

**Phase 5 – Academics and attendance.** Assessments, mark entry grid, computation engine, report cards (PDF, batch), pupil attendance, academic and attendance reports.

**Phase 6 – Reports, inventory, admin pages.** Full report set with print/PDF/Excel, inventory, calendar, announcements, document templates, global search, role dashboards.

**Phase 7 – Backup, recovery, hardening.** Manual and scheduled backups, validation, restore wizard, optional Google Drive upload, audit integrity verification, system health page, security review, performance pass with 5,000-pupil dataset.

**Phase 8 – Windows packaging and handover.** Docker-at-boot, bundled image tarball, Compose boot wrapper, Inno Setup installer, upgrade/migration flow, firewall setup, desktop shortcut, install and user docs, demo and clean-install builds, final e2e run on a clean Windows 10 and Windows 11 VM with Docker Engine starting at boot. (D031: no host Node.)

**Definition of done for every phase:** all tests pass, no TypeScript errors, no lint errors, features reachable from the UI, permissions enforced server-side, audit entries verified, docs updated, short demo script written in `docs/DEMO.md`.
