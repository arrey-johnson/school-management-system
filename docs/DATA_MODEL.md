# Data model (Phase 1)

Foundation tables: `school_profile`, `academic_years`, `terms`, `sections`, `levels`, `users`, `roles`, `permissions`, `role_permissions`, `sessions`, `login_attempts`, `audit_log`, `settings`, `number_sequences`.

```mermaid
erDiagram
  roles ||--o{ users : has
  roles ||--o{ role_permissions : grants
  permissions ||--o{ role_permissions : granted
  users ||--o{ sessions : opens
  academic_years ||--o{ terms : contains
  sections ||--o{ levels : contains
```

Primary keys are UUIDv7. Money (later) is INTEGER FCFA. Audit rows are append-only with `prev_hash` / `row_hash`.
