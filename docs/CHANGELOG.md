# Changelog

## 0.1.0 — Phase 1 Foundation

- Monorepo: `apps/server`, `apps/web`, `packages/shared`.
- SQLite + Drizzle schema for users, roles, sessions, audit, settings, sequences, school profile, years/terms/sections/levels.
- Auth: argon2, HTTP-only sessions, CSRF, lockout, first-login password change.
- RBAC with default Cameroon school roles; server-side enforcement.
- Audit log hash chain and verify endpoint.
- First-run wizard UI.
- Purple/white app shell.
- Docker Compose as the production runtime.
