# Data model (Phase 3)

Foundation, pupils, and fees. Money columns are INTEGER FCFA. Payments, allocations, receipts, reversals, adjustments, and audit rows are append-only.

```mermaid
erDiagram
  pupils ||--o{ pupil_invoices : billed
  pupil_invoices ||--o{ invoice_lines : contains
  fee_items ||--o{ invoice_lines : snapshotted
  invoice_lines ||--o{ adjustments : corrected
  pupils ||--o{ payments : pays
  payments ||--o{ payment_allocations : splits
  invoice_lines ||--o{ payment_allocations : receives
  payments ||--o| receipts : numbered
  payments ||--o{ reversals : voided
```

Balances = invoice lines + applied adjustments − net allocations. Receipt numbers come from `number_sequences.receipt` in the same transaction as the payment.
