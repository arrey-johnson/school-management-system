# Demo — Phase 2 Structure and pupils

1. Start the stack: `docker compose up --build`.
2. Open `http://localhost:3847/setup` and complete Super Admin, school **ALL BRIGHT CHILDREN**, year **2026/2027**.
3. Open **School structure**. Add class **Form 1** stream **A**, then a subject (e.g. ENG / English). Confirm grading defaults (Primary /100, Secondary /20).
4. Open **Admissions**. Create an application for Amina Ngono, Form 1, guardian phone `677111222`.
5. Review → Accept → enrol into **Form 1 A**. Admission number should be `ABC-2026-0001`.
6. Open **Pupils**, search `Amina` and `677111222`. Open the pupil and check the timeline and guardian.
7. Enrol another pupil directly from the directory, or import a CSV with header `givenName,familyName,sex,dob,classStream,guardianGivenName,guardianFamilyName,guardianPhone,relationship` (classStream like `Form 1 A`). Dry-run errors appear for unknown classes.
8. Sign in as a **teacher**: Admissions create is denied (no manage permission).
