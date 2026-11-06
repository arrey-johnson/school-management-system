# Demo — Phase 4 Staff, payroll, expenses

1. Hard-refresh `http://localhost:3847` after `docker compose up --build`.
2. **Staff**: add Mary Teacher with a national ID. Sign in as **headteacher** — the ID column is blank. Sign in as **HR** — the ID is visible.
3. **Payroll**: add a statutory percent deduction (label it configurable), save a salary structure (base `200000` + 4%), optional advance, **Calculate run** for `2026-11`.
4. HR cannot approve their own run. Sign in as Super Admin or Proprietor and approve, then mark paid / lock. Open the payslip PDF.
5. **Expenses**: bursar adds category Utilities, a draft ENEO bill, submits. Bursar cannot approve. Admin/proprietor approves; bursar marks paid.
