# Data model (Phase 4)

Staff, payroll, and expenses sit beside the Phase 3 fee ledger. Salary and expense amounts are INTEGER FCFA. Finalised payroll runs are not edited in place (next-period correction).

```mermaid
erDiagram
  staff ||--o{ staff_status_history : tracks
  staff ||--o{ staff_assignments : assigned
  staff ||--o{ salary_structures : paid
  salary_structures ||--o{ salary_structure_lines : components
  payroll_runs ||--o{ payroll_lines : contains
  expense_categories ||--o{ expenses : classified
  expense_categories ||--o{ budgets : capped
```
