# Demo — Phase 6 Reports, inventory, dashboards

1. Hard-refresh `http://localhost:3847` after `docker compose up --build`.
2. **Overview**: Super Admin sees pupil/staff counts, fee cards, activity. Sign in as **teacher** — fees are hidden; “my classes / attendance to submit / marks pending” shows. Sign in as **secretary** for the admissions queue.
3. **Search**: Ctrl+K, type a pupil name. Teacher results omit receipts.
4. **Reports**: open Pupils, Print / Excel / PDF. Excel is a UTF-8 CSV. Export is written to the audit log. Teacher cannot open Payroll.
5. **Inventory**: add SKU `CHALK-01`, stock in 10, stock out 6. Quantity is 4; low-stock flags when at or below min. Direct quantity fields do not exist. Outbound above on-hand is refused.
6. **Admin**: add a calendar event, an announcement (`audience: all`), a letter template with `{{pupil.givenName}}`, merge onto a pupil.
