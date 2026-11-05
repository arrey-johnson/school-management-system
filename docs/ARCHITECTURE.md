# Architecture

Promptstack School Management is a **single-process local web application**. One Windows PC is the school server. Staff browsers on the LAN are the only clients. There is no cloud runtime for core features.

## 1. System overview

```mermaid
flowchart LR
  subgraph LAN["School LAN"]
    T1["Staff PC browsers"]
    T2["Teacher / bursar / secretary"]
    S["Windows school server"]
  end

  T1 --> S
  T2 --> S

  subgraph Server["One Node 20 process"]
    W["Static web app\nReact 18 + Vite build"]
    A["Fastify /api/v1"]
    J["Jobs\nbackup, integrity"]
  end

  S --> W
  S --> A
  S --> J

  subgraph Disk["C:\\ProgramData\\PromptstackSMS"]
    DB["SQLite WAL\napp.db"]
    U["uploads"]
    L["logs"]
    B["backups *.sms-backup"]
  end

  A --> DB
  A --> U
  J --> DB
  J --> B
  A --> L
```

- **apps/web**: React 18, React Router, TanStack Query/Table, RHF+Zod, Tailwind (purple/white tokens), Recharts, i18n.
- **apps/server**: Fastify, Zod, sessions, RBAC, modules, pdfmake, exceljs, jobs.
- **packages/shared**: schemas, permission catalogue, money helpers, grading/ranking (pure functions).
- **installer/** (Phase 8): bundled Node, NSSM service, firewall, desktop shortcut, Inno Setup.

Clients never talk to SQLite. All writes go through the API so permissions, validation, audit, and sequences stay in one place.

## 2. Windows server deployment

Target: one Windows 10/11 PC that stays on during school hours (and preferably overnight for scheduled backup).

| Piece | Behaviour |
|---|---|
| Installer | Inno Setup copies Node + app into Program Files, creates `C:\ProgramData\PromptstackSMS\`, writes a machine session secret, opens TCP 3847 on Private networks, registers NSSM service `PromptstackSMS`, shortcut “Open School System” |
| Service | Auto-start, restart on crash, stdout/stderr to `logs\` with rotation |
| Process | `node apps/server` (or compiled entry) serving static UI + API |
| Upgrade | New installer stops service → copies files → starts service. On start: pre-migration backup, Drizzle migrate, then listen. Failure: do not listen; keep previous backup |
| Server status | Admin page shows hostname, LAN IPs, `http://<ip>:3847`, QR code, version, last backup, disk free |
| Offline | No phone-home. Optional Drive upload is a queued job |

Dev machines use `pnpm dev` (Vite + Fastify) with `.data/` instead of ProgramData.

## 3. Request flow

```mermaid
sequenceDiagram
  actor User
  participant Browser
  participant Fastify
  participant RBAC
  participant Service
  participant SQLite
  participant Audit

  User->>Browser: Open http://server:3847
  Browser->>Fastify: GET / (static SPA)
  User->>Browser: Submit form (e.g. record payment)
  Browser->>Fastify: POST /api/v1/... Cookie + CSRF + Idempotency-Key
  Fastify->>Fastify: Helmet, rate limit, Zod parse
  Fastify->>SQLite: Load session
  Fastify->>RBAC: permission + teacher/class scope
  alt denied
    Fastify-->>Browser: 401 / 403 error envelope
  else allowed
    Fastify->>Service: use case
    Service->>SQLite: BEGIN IMMEDIATE
    Service->>SQLite: ledger + sequence + receipt
    Service->>Audit: append row with hash chain
    Service->>SQLite: COMMIT
    Fastify-->>Browser: 201 JSON
  end
```

Conventions:

- REST `/api/v1/...`, JSON, shared types.
- Errors: `{ error: { code, message, fields? } }`.
- List endpoints: page, pageSize, sort, filters; indexes sized for 5,000 pupils / 100,000 transactions.
- Financial writes: `BEGIN IMMEDIATE` so two cashiers cannot mint the same receipt number.
- SPA routing: Fastify falls back to `index.html` for non-API GETs.

## 4. Auth and permissions

```mermaid
flowchart TB
  L[Login: username + password] --> H[argon2 verify]
  H --> K{failures}
  K -->|5 in 15 min| Lock[Lock account]
  K -->|ok| PW{must_change_password}
  PW -->|yes| Change[Forced change]
  PW -->|no| Sess[Insert sessions row\nSet HTTP-only cookie]
  Sess --> Req[Each request]
  Req --> Idle{idle greater than timeout?}
  Idle -->|yes| 401
  Idle -->|no| Perm[RBAC: role_permissions]
  Perm --> Scope[Resource scope\ne.g. teacher class_subjects]
  Scope --> Handler[Route handler]
```

**Roles (defaults, Super Admin editable):** Super Admin, Proprietor/Management, Headteacher, Accountant/Bursar, Secretary/Admissions, Teacher, HR/Administrator.

**Permissions** are `resource:action` strings (example: `payments:create`, `payments:reverse`, `payments:approve`, `pupils:update`, `payroll:view`, `system:backup`). The UI hides nav items the user lacks; the server still checks.

**Sensitive fields:** `pupils.medical_notes`, `staff.national_id`, salary columns — omitted unless the permission is present.

**Maker-checker:** `approval_requests` for reversals, discounts above threshold, payroll finalise, cash-up reopen. Approver ≠ maker.

**Audit:** every write stores who, when, IP/workstation, module, action, entity id, before JSON, after JSON, reason, `prev_hash`, `row_hash`. Users are disabled, never deleted, so audit attribution remains.

## 5. Backup design

```mermaid
flowchart TD
  T[Manual button or daily schedule] --> Snap[SQLite backup API\nconsistent snapshot]
  Snap --> Files[Copy uploads]
  Files --> Man[Manifest: version, checksums, row counts]
  Man --> Arch["Write timestamped .sms-backup"]
  Arch --> Val[Checksum + open snapshot read-only\nPRAGMA integrity_check]
  Val -->|fail| Alert[Log + admin warning]
  Val -->|ok| Keep[Retain last N in backups folder]
  Keep --> Drive{Drive enabled and online?}
  Drive -->|yes| Up[Upload]
  Drive -->|no| Q[Queue / retry]

  R[Restore wizard] --> V2[Validate archive]
  V2 --> Preview[Show what will be replaced]
  Preview --> Type[Type confirmation phrase]
  Type --> Safety[Automatic safety backup of current data]
  Safety --> Swap[Replace db + uploads]
  Swap --> Restart[Restart service]
```

Rules:

- Never copy a live `app.db` with the file API; always the SQLite backup API so WAL is consistent.
- Restore refuses to proceed without a fresh safety backup.
- Admin dashboard: red warning if no successful backup in 48 hours.
- Drive is optional, off by default, never required to run the school.

## 6. Module map (logical)

| Area | Server module | Web features |
|---|---|---|
| Foundation | `auth`, `rbac`, `audit`, `config`, `db` | Shell, login, wizard, settings |
| Structure / pupils | `academic`, `admissions`, `pupils` | Structure, applications, directory |
| Finance | `fees`, `expenses` | Payments, receipts, cash-up, expenses |
| People | `staff`, `payroll` | HR, payroll runs, payslips |
| Learning | `academics`, `attendance` | Marks grid, report cards, registers |
| Ops | `reports`, `inventory`, `admin`, `backup`, `system` | Reports, stock, health, restore |

Shared rules (money, sequences, grading, permissions) live in `packages/shared` and are unit-tested there; the server is the only place they are applied to data.
