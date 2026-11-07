# Security review (Phase 7)

Offline LAN app. The school LAN is the trust boundary (D006). This checklist is the OWASP-oriented pass for v1.

| Topic | Status |
|---|---|
| Broken access control | Server `requirePermission` on every route. Teacher scope on marks/attendance. National ID and payroll extra checks. Tests for 403. |
| Cryptographic failures | Passwords argon2. Session id hashed at rest. No TLS on LAN (accepted). |
| Injection | Zod on inputs. Drizzle parameterized SQL. Backup filenames basename + regex. Archive paths reject `..`. |
| Insecure design | Append-only payments and audit. Maker-checker on money. Restore confirmation phrase. |
| Security misconfiguration | Helmet, CSRF, rate limit, `trustProxy`. Request logs omit bodies (no passwords). |
| Vulnerable components | Docker Node 20 image; `pnpm` lockfile. Re-audit at each installer release. |
| Identification failures | Lockout after 5 failures. Idle 30 min. Users disabled never deleted. |
| Data integrity | Audit hash chain + SQLite triggers blocking UPDATE/DELETE on `audit_log`. Backup checksum + `PRAGMA integrity_check`. |
| Logging failures | Audit log for writes. Request id `x-request-id`. Login attempts table stores username not password. |
| SSRF | No outbound HTTP required. Drive upload queued only when enabled. |

Uploads: Phase 7 does not add a public upload API. When files appear under `uploads/`, restore unpacks only relative paths.
