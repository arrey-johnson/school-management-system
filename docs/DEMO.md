# Demo — Phase 3 Fees and payments

1. `docker compose up --build` and finish first-run setup if needed.
2. **School structure**: add **Form 1 A**.
3. **Fees & Payments**: add fee item `TUI` / Tuition / `50000`.
4. **Pupils**: enrol Amina Ngono into Form 1 A (invoice is created automatically).
5. On **Fees & Payments**, search `Amina` (or `ABC-2026-0001`), pay `20000` cash. A receipt PDF opens as `RC-00001`. Pay the remaining `30000` as `RC-00002`. Balance should be paid.
6. Sign in as a **bursar**, record a payment, request reverse. Sign in as **admin** and approve. The maker (bursar) cannot approve their own reversal.
7. Add a **FCFA 15,000** discount — it stays pending until a second user approves.
8. Close cash-up for today; further payments that day by the same cashier are blocked until reopen is approved.
9. Overview shows outstanding fees.
