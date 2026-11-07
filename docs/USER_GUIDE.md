# User guide (short)

Open the school system in a browser on the LAN. Sign in with the account the Super Admin created for you. After 30 minutes idle you will need to sign in again.

| Who | Typical work |
|---|---|
| Super Admin | Users, backups, restore (`RESTORE SCHOOL DATA`), health, first-run |
| Proprietor | Dashboards, reports, approve large discounts / reversals / payroll |
| Headteacher | Structure, marks unlock, attendance, inventory, calendar |
| Bursar | Fees, payments, receipts, expenses, cash-up |
| Secretary | Admissions, pupils, announcements |
| Teacher | Own class attendance and marks only |
| HR | Staff records and payroll preparation |

Money is whole FCFA. Payments are never silently edited — reversals need a second person. Print receipts from the fees screen. Report cards and class lists are under **Reports**.

If the site will not open: on the **server** PC, start Docker, then run `Start-PromptstackSMS.ps1`, then retry `http://localhost:3847`. Other PCs cannot start the system.
