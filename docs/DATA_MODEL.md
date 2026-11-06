# Data model (Phase 5)

Academics sit beside the academic tree from Phase 2. Marks may be fractional; money remains INTEGER FCFA elsewhere. Term results are recomputed snapshots, not live views. Payments stay append-only.

```mermaid
erDiagram
  assessment_types ||--o{ assessments : typed
  assessments ||--o{ marks : scored
  class_subjects ||--o{ assessments : offered
  pupils ||--o{ marks : receive
  classes ||--o{ term_results : snapshot
  pupils ||--o{ report_cards : issued
  classes ||--o{ pupil_attendance : register
```
