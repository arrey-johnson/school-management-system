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

**Reason:** Spec: only one app process. That process runs **inside the Compose container** (D031). Simpler firewall (one published port) and backup story (host data dir).

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

**Decision (superseded by D031):** Originally: installer registers Node with NSSM; node-windows as fallback.

**Superseded:** Production does not run Node on the host. NSSM (or equivalent) may still exist in Phase 8 only as a **wrapper that starts Docker Compose** after the engine is up — never as a host Node process. There is no native-Node fallback.

## D010 — Data directory

**Decision:** Production data root `C:\ProgramData\PromptstackSMS\` with `data\app.db`, `uploads\`, `logs\`, `backups\`. Dev uses `.data/` in the repo (gitignored).

**Reason:** Spec installer path. ProgramData survives user profile changes and is the correct machine-wide location.

## D011 — pdfmake for PDFs, exceljs for Excel

**Decision:** `pdfmake` for receipts, report cards, letters. `exceljs` for Excel/CSV.

**Reason:** Spec allows pdfmake or react-pdf. pdfmake generates in the container without a browser, which matches a headless Compose service.

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

## D031 — Docker is the only production runtime (no native fallback)

**Decision:** The school server **must** run Docker Engine (Docker Desktop or Engine-in-WSL) **at boot**. The application runs **only** as Docker Compose. If the engine is down, the school system is down. There is **no** host Node / NSSM-Node / “run without Docker” path.

This supersedes spec section 2’s “bundle Node and run it as a Windows service” and supersedes the original D009/D031 optional-Docker wording. Confirmed by the product owner (2026-11-06): Docker handles everything at install time and at the school.

**Runtime:**
- One Compose service `app`: Node 20, Fastify + static UI, `restart: unless-stopped`, port **3847:3847**.
- No extra database container. SQLite remains a file on a **host bind mount**.
- Data stays at `C:\ProgramData\PromptstackSMS\` on the Windows host (D010). The container must not own the only copy of the DB.
- `better-sqlite3` is compiled **inside the Linux image**. Host `node_modules` are never copied in.
- SQLite locking: local disk only; never two writers (host `pnpm` and container) on the same file.

**School machine:**
- Windows 10/11, 64-bit, virtualization enabled, WSL2 if using Docker Desktop, **8 GB RAM minimum (16 GB recommended)**.
- Docker set to **start on boot** (Desktop start-on-login plus the server account left logged in, auto-logon, or Engine as a boot service). Phase 8 scripts wait until `docker info` succeeds, then `docker compose up -d`.
- Installer **fails closed** if Docker is missing or the engine is not running.

**Offline / installer (Phase 8):**
- No `docker pull` at the school. Ship a pre-built image tarball; installer runs `docker load`.
- Creates data dir, session secret, firewall rule for TCP 3847, Compose files, boot wrapper, desktop shortcut “Open School System”.
- Upgrade: load new image → compose up → app takes pre-migration backup then migrates. Image replace is not a data wipe because data is on the host mount.

**Development:**
- Phase 1 adds `Dockerfile`, `docker-compose.yml`, `.dockerignore`.
- `pnpm dev` on the host is allowed for coding only. Production-shaped behaviour is Compose. Demo and handover always use Compose.

**Reason:** Owner requires one runtime everywhere so install, upgrades, and native addons match what we develop against. LAN clients stay browsers. Spec NFR “works offline” is met by shipping the image, not by pulling it. The cost is operational: Hyper-V/WSL, RAM, and “Docker didn’t start after reboot” become first-line failures; that is accepted.

## D032 — Auto commit and push after successful work

**Decision:** After each successful completed unit of work, the agent commits and pushes to the remote without being asked. Incomplete, failed, or secret-bearing changes are not committed. Never force-push or skip hooks.

**Reason:** Owner request (2026-11-06) so school-system progress is always on `origin`. Enforced by `.cursor/rules/git-auto-push.mdc` and a `stop` hook that reminds the agent if the tree is still dirty.

## D033 — Host pnpm vs Docker native addons

**Decision:** `better-sqlite3` and `argon2` are compiled inside the **Node 20 Linux image**. On a Windows host without Python/MSVC (or on Node 24 without prebuilds), `pnpm install --ignore-scripts` is allowed for JS tooling; `pnpm check` that needs SQLite runs with `pnpm check:docker`.

**Reason:** Docker is the production runtime (D031). Native addons must match the Linux container, not the developer’s Windows Node version.

## D034 — One enrolment per pupil per year; promote replaces the row

**Decision:** `enrolments` is unique on `(pupil_id, academic_year_id)`. Bulk promote deletes the source-class row and inserts the target-class row in one transaction, tagged with `promotion_batches`. Undo (48 hours) reverses that swap. Historical class movement for the same year is visible on the batch record and audit log, not as stacked enrolment rows.

**Reason:** A pupil cannot sit in two classes in the same year. Timeline still shows remaining enrolment and status events.

## D035 — Receipt PDF without a browser

**Decision:** Receipts are generated in-process as a one-page PDF (Helvetica text: school, pupil, lines, balance, verification code). Reprint sets status `duplicate_reprint` and prints DUPLICATE. Reversal watermarks REVERSED. A later pass may swap the builder for full pdfmake templates without changing numbers or ledger rules.

**Reason:** D011 still holds; Phase 3 ships a printable file the bursar can open offline. Layout polish is not allowed to delay money correctness.

## D036 — Proprietor approves payroll and expenses

**Decision:** Default Proprietor grants include `payroll:approve` and `expenses:approve` (already had `payments:approve`). HR prepares payroll; bursar manages expenses; neither can approve their own record.

**Reason:** Maker-checker needs a second role besides Super Admin on a typical school staff list.

## D037 — Payroll percents round to whole FCFA

**Decision:** Percent components use `Math.round(base * percent / 100)`. Absence deduction is `absentDays * round(base / 30)` in that calendar month. Statutory flags are labels only; rates are settings, not Cameroon legal advice.

**Reason:** XAF has no subunits. Rounding is explicit so cashiers and HR can recast a payslip by hand.
