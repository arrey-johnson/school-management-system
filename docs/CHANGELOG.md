# Changelog

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
