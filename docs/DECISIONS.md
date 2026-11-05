# Decisions

Each entry is a choice we will implement unless a later dated entry supersedes it. When a requirement was ambiguous, the safest sensible default was chosen so work can continue.

## D001 — Monorepo with pnpm workspaces

**Decision:** pnpm workspaces: `apps/server`, `apps/web`, `packages/shared`, `installer/`.

**Reason:** Matches the spec stack. Shared Zod schemas and permission strings cannot drift between UI and API. pnpm is strict about dependency layout, which helps a Windows installer later.

## D002 — SQLite + Drizzle + better-sqlite3

**Decision:** One SQLite file, WAL, foreign keys ON, Drizzle ORM and versioned migrations, `better-sqlite3` (synchronous).

**Reason:** Spec default. A single file is the backup unit. Scale (~700 pupils, headroom to 5,000) is well inside SQLite. Synchronous driver plus a single Node process gives simple, serialisable transactions for receipt numbers.

## D003 — Integer FCFA, derived balances

**Decision:** All money columns are `INTEGER` (XAF has no subunits). Pupil balances are derived from ledger rows (invoice lines, adjustments, allocations). Optional cached balance only if a verification job exists; never an editable field.

**Reason:** Floats cause silent rounding errors. Derived ledgers match append-only payments.

## D004 — UUIDv7 primary keys

**Decision:** UUIDv7 for all primary keys. Human-facing numbers (admission, receipt) live in dedicated unique columns filled from `number_sequences`.

**Reason:** Spec allows ULID or UUIDv7. UUIDv7 is sortable by time, widely supported, and avoids a second ID library if the runtime provides it (or a small helper). Sequences stay gap-free for receipts without using them as PKs.

## D005 — One process, server serves the web app

**Decision:** Fastify serves `/api/v1` and the Vite production build as static files. Development: Vite dev server proxies API.

**Reason:** Spec: only one process on the school PC. Simpler Windows service, firewall, and backup story.

## D006 — HTTP on the LAN in v1 (no TLS)

**Decision:** Listen on HTTP, default port **3847**, bind `0.0.0.0`. Document that the school LAN is the trust boundary. HTTPS/local CA is a later option, not Phase 1.

**Reason:** No internet and no local PKI. Forcing TLS would block first install. Cookies use `Secure` only when HTTPS is enabled; on HTTP LAN use `HttpOnly`, `SameSite=Lax`, and CSRF tokens.

## D007 — Sessions in SQLite, cookies, argon2

**Decision:** Session rows in SQLite; opaque session id in an HTTP-only cookie; passwords hashed with argon2. Idle timeout 30 minutes (configurable). Absolute lifetime 12 hours. Lockout after 5 failed logins for 15 minutes. First login must change password.

**Reason:** Spec auth requirements. SQLite session store survives process restart without Redis. Defaults are conservative for a shared staff room PC.

## D008 — CSRF, helmet, rate limit

**Decision:** Double-submit or synchronizer CSRF token for cookie-authenticated mutating requests; `@fastify/helmet`; `@fastify/rate-limit` (stricter on `/login`).

**Reason:** Spec security list. SameSite=Lax is not enough on a LAN with multiple browser users.

## D009 — NSSM for the Windows service

**Decision:** Installer registers the app with **NSSM** (Non-Sucking Service Manager), auto-start, auto-restart. node-windows remains a fallback if NSSM packaging is blocked.

**Reason:** Spec allows either. NSSM is the usual operational choice on school PCs (recovery, stdout to log files, restart delay).

## D010 — Data directory

**Decision:** Production data root `C:\ProgramData\PromptstackSMS\` with `data\app.db`, `uploads\`, `logs\`, `backups\`. Dev uses `.data/` in the repo (gitignored).

**Reason:** Spec installer path. ProgramData survives user profile changes and is the correct machine-wide location.

## D011 — pdfmake for PDFs, exceljs for Excel

**Decision:** `pdfmake` for receipts, report cards, letters. `exceljs` for Excel/CSV.

**Reason:** Spec allows pdfmake or react-pdf. pdfmake generates on the server without a browser, which matches a headless Windows service.

## D012 — Page-based list APIs

**Decision:** Lists use `page` (1-based), `pageSize` (default 50, max 200), `sort`, and filter query params. Activity feeds may add cursors later.

**Reason:** Spec allows cursor or page. School staff think in pages. Document in OpenAPI.

## D013 — Error envelope

**Decision:** `{ error: { code, message, fields? } }` with stable string codes (`VALIDATION`, `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `PERIOD_LOCKED`, `IDEMPOTENT_REPLAY`, …).

**Reason:** Spec API convention. `fields` carries Zod issue paths for forms.

## D014 — Maker-checker and discount threshold

**Decision:** Shared `approval_requests` table. Reversals, discounts/adjustments above **FCFA 10,000** (setting), cash-up reopen, and payroll finalisation need a second user with the matching `*:approve` permission. Maker cannot approve self.

**Reason:** Spec workflow. Threshold is a safe default until the school confirms policy.

## D015 — Teacher data scope

**Decision:** Enforced in services: teachers may read/write attendance and marks only for `staff_assignments` / `class_subjects` in the active year. Class lists limited the same way. No salary, medical, or other pupils.

**Reason:** Spec. UI hiding is not sufficient.

## D016 — Receipt numbering

**Decision:** `number_sequences` row `receipt` incremented inside the payment transaction. Format default `RC-00001` (prefix + padding configurable). No gaps: failed txn rolls back the increment. Reprints keep the same number and mark DUPLICATE. Reversal does not reuse the number.

**Reason:** Spec: sequential, no gaps, generated in a DB transaction.

## D017 — Duplicate payment warning vs block

**Decision:** Same pupil + same amount + same calendar day (Africa/Douala) shows a blocking confirmation requiring an explicit `confirmDuplicate` flag. Idempotency-Key header: same key + same body returns the original result; same key + different body is `CONFLICT`.

**Reason:** Spec asks for idempotency and a warning. Confirmation flag keeps accidents rare without making legitimate two-part payments impossible.

## D018 — Period locks

**Decision:** Lock by calendar month and/or term. New financial rows must have `entry_date` in an open period. Corrections to a locked period are adjustment entries dated in the open period, linking to the original.

**Reason:** Spec period locking without rewriting history.

## D019 — Ranking ties

**Decision:** Default **competition / min rank** (1, 2, 2, 4). Configurable later. Missing marks: excluded from that subject average unless the school sets “treat missing as zero”. Nursery: competency comments, no numeric rank.

**Reason:** Common Cameroon report-card practice; labelled on the card so it is not a surprise.

## D020 — Report card withhold

**Decision:** Setting `academics.withholdReportCardIfFeesOutstanding` defaults **false**.

**Reason:** Spec says optional. Defaulting true could block academic process before the school confirms.

## D021 — Bulk promotion undo

**Decision:** Undo allowed for 48 hours, cancelled earlier if any mark, attendance, or fee allocation exists against the new enrolment.

**Reason:** Spec undo window without allowing silent history rewrite after the year has moved on.

## D022 — i18n

**Decision:** `i18next`-style JSON `en.json` / `fr.json`. English complete from first UI. French: navigation and common labels from Phase 1, remaining strings filled as screens ship. Per-user language on `users.locale`.

**Reason:** Spec minimum. Structure strings from day one so French is not a retrofit.

## D023 — Demo vs production

**Decision:** Seed/demo accounts only when `SMS_DEMO=1` or a demo installer flavour. Production installer: empty DB + first-run wizard + one Super Admin created at install.

**Reason:** Spec. Demo passwords must never ship in the production path.

## D024 — Google Drive backup

**Decision:** Off by default. Local backup is the source of truth. Drive is a queued job that fails soft.

**Reason:** Spec: core operation never requires internet.

## D025 — Audit hash chain

**Decision:** Each `audit_log` row stores `prev_hash` and `row_hash` (SHA-256 over canonical JSON of the row plus prev). Genesis prev_hash is 64 zeros. “Verify audit integrity” walks the chain. Application never updates/deletes audit rows (SQLite trigger as belt-and-braces).

**Reason:** Spec tamper evidence.

## D026 — Tooling timing

**Decision:** Phase 0 commit is documentation and repo hygiene only. pnpm/TypeScript/ESLint/Vitest/Playwright/Drizzle are the first tasks of Phase 1.

**Reason:** The go-ahead message asked to scaffold without feature code and to stop after planning. Spec Phase 0 also lists tooling; splitting avoids an unreviewable half-app.

## D027 — Time, dates, currency display

**Decision:** Store timestamps in UTC ISO/text; display in **Africa/Douala**. Dates `DD MMM YYYY`. Money `FCFA 75,000` (thin space or comma thousands, no decimals).

**Reason:** Spec NFR.

## D028 — Admission numbers never reused

**Decision:** Sequence never rolls back on rejected applications that already received a number. Numbers are issued only on enrol convert (not on apply), default `ABC-{YEAR}-{SEQ:4}`.

**Reason:** Spec: unique, never reused. Issuing at enrol avoids burning numbers for rejected applicants.

## D029 — OpenAPI

**Decision:** Fastify schema from Zod (or equivalent) → OpenAPI at `/api/docs`, permission `system:openapi`.

**Reason:** Spec. Admin only.

## D030 — Inter font bundled

**Decision:** Self-host Inter in `assets/` / web public files. No CDN.

**Reason:** Offline requirement.
