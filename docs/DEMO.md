# Demo — Phase 5 Academics and attendance

1. Hard-refresh `http://localhost:3847` after `docker compose up --build`.
2. Ensure Form 1 A exists with a subject offering (Structure) and enrolled pupils.
3. **Academics**: add assessment type Sequence 1 (weight 1, max 20) for Term 1. Open the assessment, enter marks 0–20, Save draft, Submit and lock. Teacher cannot unlock; Headteacher/Admin Unlock.
4. Compute term results. Tied averages share the minimum rank (1, 1, 3). Open a report card PDF.
5. **Attendance**: pick the class and day, mark Present/Absent/Late/Excused, Submit register. An unassigned teacher is refused.
