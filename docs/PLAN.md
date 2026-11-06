# Phase 0 plan

Source documents: [SPEC.md](./SPEC.md), [BUILD_PLAN.md](./BUILD_PLAN.md). Decisions that fix ambiguities live in [DECISIONS.md](./DECISIONS.md). System shape lives in [ARCHITECTURE.md](./ARCHITECTURE.md).

Status: Phase 0 planning and docs-only scaffold. Monorepo tooling (pnpm workspaces, TypeScript, lint, tests) is deferred to the start of Phase 1 so this commit stays documentation-only.

## 1. Final folder structure

```
school-management-system/
  .cursor/rules/sms.mdc
  .editorconfig
  .gitignore
  .nvmrc                          # Node 20
  README.md
  package.json                    # Phase 1: pnpm workspace root
  pnpm-workspace.yaml             # Phase 1
  tsconfig.base.json              # Phase 1
  eslint.config.js                # Phase 1
  .prettierrc                     # Phase 1
  apps/
    server/
      package.json
      tsconfig.json
      drizzle.config.ts
      src/
        index.ts
        config/
        db/
          schema/
          migrations/
          seed/
        auth/
        rbac/
        audit/
        modules/
          academic/
          pupils/
          admissions/
          fees/
          expenses/
          staff/
          payroll/
          academics/
          attendance/
          reports/
          inventory/
          admin/
          backup/
          system/
        jobs/
        pdf/
        excel/
        plugins/
        utils/
      tests/
    web/
      package.json
      tsconfig.json
      vite.config.ts
      index.html
      src/
        app/                      # router, providers, layout shell
        components/
        features/                 # one folder per module
        lib/                      # api client, money, dates
        i18n/                     # en.json, fr.json
        styles/
      e2e/                        # Playwright
  packages/
    shared/
      package.json
      tsconfig.json
      src/
        schemas/
        types/
        permissions/
        money/
        grading/
        constants/
  installer/                      # Phase 8: Docker load, Compose boot wrapper, firewall, Inno Setup
  docker/
  Dockerfile                      # Phase 1: Node 20, one-process image
  docker-compose.yml              # Phase 1: app + data volume, port 3847
  .dockerignore                   # Phase 1
  docs/
  assets/                         # logo-white.png (later), Inter, icons
  scripts/                        # seed, backup CLI, dev helpers
```

Production data lives on the **Windows host** under `C:\ProgramData\PromptstackSMS\` (`data\`, `uploads\`, `logs\`, `backups\`) and is bind-mounted into the container. Development uses `.data/` (gitignored), also bind-mounted under Compose. The live database is never stored only inside an image.

## 2. Database schema outline per module

Primary keys: UUIDv7 (sortable, unique). Money: `INTEGER` FCFA. Mutable tables: `created_at`, `updated_at`, `created_by`, `updated_by`. Master data: `archived_at` instead of hard delete. Append-only: payments, receipts, reversals, adjustments, audit_log, stock_movements. Foreign keys ON.

### 2.1 Academic structure and settings
- `school_profile` — singleton: name, motto, address, phones, email, logo/stamp/signature file refs.
- `academic_years` — name, start/end, `is_active` (exactly one active, enforced in service + partial unique index).
- `terms` — year_id, sequence (1–3 default), name, start/end.
- `sections` — Nursery / Primary / Secondary (renameable).
- `levels` — section_id, name, sort_order (Nursery 1–2, Class 1–6, Form 1–5, L6, U6).
- `classes` — year_id, level_id, stream/arm, class_teacher_staff_id, capacity.
- `subjects` — code, name, year-scoped or global with year overlay.
- `class_subjects` — class_id, subject_id, staff_id (teacher), coefficient.
- `grading_scales` / `grading_scale_bands` — per section: min/max, letter, remark, pass_mark, score_out_of (20 or 100).
- `settings` — key/value JSON with Zod schemas per key.
- `holidays` / `events` — calendar.

### 2.2 Admissions and pupils
- `applications` — status workflow, class applied for, previous school, document refs.
- `pupils` — names, sex, dob, pob, nationality, photo, address, medical_notes (restricted), previous school, admission_number (unique, never reused).
- `pupil_status_history` — status, dates, reason.
- `guardians` — reusable across siblings.
- `pupil_guardians` — relationship, primary_contact, fee_payer.
- `enrolments` — unique (pupil_id, academic_year_id), class_id, placement type (new/promote/repeat/transfer).
- `siblings` — optional explicit link; also inferred via shared guardian.
- `discipline_notes` — timeline entries.

### 2.3 Fees and payments
- `fee_items` — name, optional/mandatory, applies to section/level/class, term or year, amount_fcfa, installment plan JSON.
- `fee_structures` — versioned assignment of items to a year/term/class.
- `pupil_invoices` — per pupil per year (or per term); status derived.
- `invoice_lines` — fee item snapshot (amount never mutated after issue).
- `adjustments` — discount/waiver/late fee/scholarship; reason; approval_id; linked invoice line; append-only.
- `payments` — amount_fcfa, channel, reference, payer, recorded_by, idempotency_key unique, date; append-only.
- `payment_allocations` — payment_id → invoice_line_id, amount_fcfa; oldest-first default.
- `receipts` — sequential number from `number_sequences` in the same transaction; verification_code; status issued/duplicate-reprint/reversed.
- `reversals` — original_payment_id, negative payment_id, reason, approval_id.
- `cash_ups` — cashier, day, totals by channel, counted cash, locked_at, reopen approval.
- `period_locks` — term or month, locked_by, locked_at.
- `approval_requests` — shared maker-checker (reversals, discounts above threshold, payroll, cash-up reopen).

Balances are **derived** from invoice lines + adjustments + allocations. A nightly/on-demand verification job recomputes and flags drift.

### 2.4 Expenses
- `expense_categories`
- `expenses` — date, amount_fcfa, vendor, method, attachment, status Draft → Submitted → Approved → Paid.
- `budgets` — category + term/year, amount_fcfa.

### 2.5 Staff and HR
- `staff` — profile, national_id (restricted), documents, status.
- `staff_status_history`
- `staff_assignments` — class teacher and/or class_subject teacher, year-scoped.
- `leaves` — type, dates, approval.
- `staff_attendance` — day, present/late/absent/leave.

### 2.6 Payroll
- `salary_component_types` — allowance/deduction, fixed or percent, statutory flag (rates configurable, not legal advice).
- `salary_structures` / `salary_structure_lines` — per staff, effective dates.
- `advances_loans` — schedule of repayments.
- `payroll_runs` — year/month, status draft → calculated → reviewed → approved → paid → locked.
- `payroll_lines` — staff snapshot of components and net_fcfa.
- `payslips` — generated PDF metadata.

### 2.7 Academics and attendance
- `assessment_types` — per term, weight, max_score, class/subject scope.
- `assessments` — instance per class/subject/type.
- `marks` — unique (assessment_id, pupil_id); score or absent/excused; draft vs submitted; lock.
- `term_results` — computed snapshot after lock (recomputable; store for report reprint stability).
- `report_cards` — generated PDF metadata, QR verification, withhold flag.
- `pupil_attendance` — unique (class_id, date, pupil_id); one submitted register per class per day.

### 2.8 Inventory and admin
- `inventory_items` — qty derived from movements; location, condition, cost_fcfa.
- `stock_movements` — in/out, reason, user; append-only.
- `announcements` — audience (role/class), expiry.
- `document_templates` — merge fields.

### 2.9 Users, security, audit, backup
- `users` — disable never delete; optional staff_id; language; must_change_password.
- `roles`, `permissions`, `role_permissions`
- `sessions` — hashed token, expires_at, last_seen_at, ip, workstation.
- `login_attempts` — lockout after N failures.
- `audit_log` — append-only; before/after JSON; prev_hash + row_hash chain.
- `number_sequences` — name, prefix, next_value, padding; updated in a transaction.
- `backups` — path, checksum, counts, validation result, drive upload status.
- `idempotency_keys` — payment (and later other) writes.

## 3. Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Money correctness and gap-free receipt numbers under concurrent cashiers | Wrong balances, duplicate or skipped receipt numbers, lost trust | INTEGER FCFA only; single SQLite writer transactions; `number_sequences` updated in the same txn as receipt insert; unique receipt number; concurrency test in Phase 3; idempotency keys |
| Permission leaks (teacher scope, medical notes, national ID, salary) | Data protection failure | Server-side RBAC on every route; query-level teacher scope filters; field-level omit for restricted columns; integration tests for denial cases |
| SQLite on a Docker bind mount (locking, `ProgramData` ACLs, WAL files) | Corrupt or unwritable DB after reboot | WAL + `synchronous=FULL`; one container writer; host-local bind mount only; busy_timeout; integrity check job; never copy live files for backup (use SQLite backup API) |
| Backup/restore unreliability | Unrecoverable school year | Snapshot via backup API + files + manifest + checksum; post-backup open-read-only integrity check; restore always takes a safety backup first; 48h backup warning; Phase 7 round-trip e2e |
| Report-card edge cases (ties, missing marks, coefficients, nursery comments) | Wrong ranks printed | Pure functions in `packages/shared` with 85%+ coverage; configurable tie rule (min rank / dense); missing marks exclude or zero per setting; snapshot results at lock time |
| Migration safety on upgrade | Broken production after installer update | Pre-migration automatic backup; Drizzle versioned migrations; migration tests with data; app refuses to start if migration fails; installer rollback notes |
| Installer on clean Windows 10/11 with Docker | Failed handover | Phase 8: Inno Setup + Docker prerequisite check + bundled image tar + firewall + Compose boot wrapper; verify on clean Win10 and Win11 VMs with Docker at boot |
| Scope creep | Delayed fees module (the highest-correctness path) | Phases 0–8 as written; no extra modules until after Phase 8; school-specific names/fees captured as settings not code forks |
| Optional Google Drive coupling | Offline breakage | Feature off by default; queue/retry; core backup is local |
| Power cuts during a write | Partial financial records | WAL + FULL sync; transactional payment+receipt+allocation; graceful shutdown |
| Docker Engine not running after reboot | Whole school system offline | D031: engine start-at-boot is mandatory; installer/boot wrapper waits for `docker info` then Compose; server status shows container health; **no native Node fallback** (accepted) |
| Host and container both opening the same SQLite file | Corruption / SQLITE_BUSY | One writer process only; never `pnpm dev` and Compose against the same `.data/` DB together |

## 4. Assumptions and chosen defaults

Documented formally in DECISIONS.md. Summary:

- Port **3847** (unprivileged, uncommon) unless installer config overrides.
- Bind `0.0.0.0` so LAN clients can connect; CSRF + same-site cookies (`lax` on HTTP LAN).
- HTTP on LAN in v1 (no TLS) because the school has no local CA; document network trust. Optional HTTPS later.
- Session store: SQLite `sessions` table (survives restart; no extra process).
- Idle timeout **30 minutes**; hard session cap **12 hours**; lockout **5 failures / 15 minutes**.
- Time zone **Africa/Douala**; locale display `DD MMM YYYY`; money `FCFA 75,000`.
- UUIDv7 primary keys; admission numbers from `number_sequences` with default `ABC-{YEAR}-{SEQ:4}`.
- Pagination: page-based (`page`, `pageSize` default 50, max 200) plus stable `sort`; cursor optional later for activity feeds.
- Receipt PDF: **pdfmake** (layout-as-data, good for receipts and report cards without a browser).
- Production: **Docker Compose only** (D031). Engine at boot. No host Node. NSSM may wrap Compose only.
- One Node process **inside the container** serves API + built web static files.
- Default language English; French files exist from Phase 1 for nav and common labels.
- Discount approval threshold default **FCFA 10,000**; Super Admin can change it.
- Report cards **not** withheld for unpaid fees until the school turns the setting on.
- Ranking ties: **min rank** (1, 2, 2, 4) with the rule labelled in reports.
- Bulk promotion undo window: **48 hours** or until any mark/payment posts against the new enrolment, whichever first.
- Demo accounts exist only in seed/demo builds; production installer is clean-install + wizard.
- Logo path reserved: `assets/logo-white.png` (added later).
- Docker Compose is mandatory at the school and for production-shaped runs (D031). `pnpm dev` is coding-only.

## 5. Task estimate per phase

Estimates are engineering days for one senior full-stack engineer, including tests and docs. Calendar time is longer if review gates sit between phases.

| Phase | Scope | Est. days | Notes |
|---|---|---|---|
| 0 Plan | Spec on disk, PLAN, DECISIONS, ARCHITECTURE, gitignore/readme scaffold | 0.5 | This commit. Tooling moved to Phase 1 start. |
| 1 Foundation | Monorepo tooling, Docker image/compose, DB, auth, RBAC, audit chain, settings, sequences, UI shell, wizard | 8–10 | First runnable app |
| 2 Structure and pupils | Years/terms/classes, admissions, pupils, guardians, enrolment, import, search | 8–10 | |
| 3 Fees and payments | Structures, invoices, payments, receipts, reversals, arrears, cash-up, locks | 12–15 | Heaviest tests |
| 4 Staff, payroll, expenses | HR, payroll maker-checker, expenses/budgets | 8–10 | |
| 5 Academics and attendance | Marks, grading engine, report cards, attendance | 10–12 | |
| 6 Reports, inventory, admin | Full report set, inventory, calendar, search, dashboards | 6–8 | |
| 7 Backup, hardening | Backup/restore, Drive optional, health, security, 5k-pupil perf | 6–8 | |
| 8 Windows packaging | Docker-at-boot, image tar, Compose wrapper, Inno Setup, upgrade, VM verification, handover docs | 6–8 | Docker-mandatory (D031) |
| **Total** | | **~65–82 days** | Plus review buffers between phases |

Phase 1 start tasks (when “start Phase 1” is given): init pnpm workspaces, TypeScript strict, ESLint/Prettier, Vitest, Playwright, Drizzle Kit, Dockerfile + Compose, `pnpm check` / `pnpm dev` / `pnpm seed` / `pnpm build`.
