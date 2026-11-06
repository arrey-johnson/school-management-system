# Build plan

## C1. Working agreement
- We build in phases (0 to 8 in the spec, section 14). One phase at a time. After each phase I review, run `pnpm check`, and say "start Phase N".
- At the start of each phase: re-read `docs/SPEC.md` and `docs/BUILD_PLAN.md`, list the tasks for the phase, then implement. At the end: run all tests, update docs, write `docs/DEMO.md` steps, commit with a clear message, push.
- After every successful unit of work (not only phase end), commit and push (D032). Do not wait to be asked. Do not commit failed or incomplete work.
- Work in small commits on a branch per phase (`phase-1-foundation`, etc.), merge to `main` when the phase passes its definition of done.

## C2. Target folder structure
```
school-management-system/
  .cursor/rules/sms.mdc
  .cursor/rules/git-auto-push.mdc
  .cursor/hooks.json
  apps/
    server/              Fastify API, services, jobs, PDF/Excel generation
      src/
        config/ db/ (schema, migrations, seed) auth/ rbac/ audit/
        modules/ (academic, pupils, admissions, fees, expenses, staff,
                  payroll, academics, attendance, reports, inventory,
                  admin, backup, system)
        jobs/ (scheduled backup, integrity checks)
        pdf/ excel/ plugins/ utils/
      tests/
    web/                 React + Vite app
      src/
        app/ (router, providers, layout shell) components/ features/<module>/
        lib/ (api client, money, dates) i18n/ (en.json, fr.json) styles/
      e2e/               Playwright tests
  packages/
    shared/              Zod schemas, types, permissions, money utils,
                         grading/ranking engine, constants
  installer/             Docker load, Compose boot wrapper, Inno Setup, firewall
  Dockerfile             Node 20 one-process image (Phase 1; production runtime)
  docker-compose.yml     app + host data bind mount, port 3847 (Phase 1; school runtime)
  docs/                  SPEC, BUILD_PLAN, PLAN, DECISIONS, ARCHITECTURE, ...
  assets/                logo-white.png, fonts (Inter), icons
  scripts/               dev helpers, seed, backup CLI
  package.json  pnpm-workspace.yaml  tsconfig.base.json  eslint + prettier config
```

## C3. Tooling to set up in Phase 0/1
pnpm workspaces, TypeScript strict, ESLint + Prettier, Vitest, Playwright, Drizzle Kit, Docker (Dockerfile + Compose; **mandatory production runtime**, D031), a root script `pnpm check` (typecheck + lint + unit + integration), `pnpm dev` (coding only), `pnpm seed`, `pnpm build`, `pnpm package:win` (installer: image tar + Compose, not host Node).

## C4. Phase checklist (tick off as we go)
- [x] Phase 0: Plan and scaffold. PLAN, DECISIONS, ARCHITECTURE, repo tooling.
- [x] Phase 1: Foundation. DB + migrations, config, logging, auth, sessions, lockout, RBAC, audit hash chain, settings, number sequences, UI shell and theme, first-run wizard.
- [x] Phase 2: Structure and pupils. Years/terms, sections/levels/classes/subjects, admissions workflow, pupils, guardians, enrolment, bulk import, search, timeline.
- [ ] Phase 3: Fees and payments. Fee items, invoices, discounts, payments, allocation, receipts, reversals with approval, arrears, cash-up, period locks, finance dashboard.
- [ ] Phase 4: Staff, payroll, expenses.
- [ ] Phase 5: Academics and attendance. Assessments, mark entry, computation engine, report cards, attendance, reports.
- [ ] Phase 6: Reports, inventory, admin pages, global search, role dashboards.
- [ ] Phase 7: Backup, recovery, hardening, performance pass, security review.
- [ ] Phase 8: Docker-at-boot, bundled image, Compose wrapper, installer, upgrade flow, install and user docs, clean-VM verification.

## C5. Order of work inside any phase
1. Shared schemas and types in `packages/shared`.
2. Database tables and migration.
3. Service layer with business rules and unit tests.
4. API routes with permission checks and integration tests.
5. UI screens using the design system.
6. E2E test for the main journey.
7. Docs and demo script.

## C6. Risk watchlist (carry into PLAN.md)
Money correctness and receipt numbering under concurrency; permission leaks (especially teacher scoping and salary data); SQLite on a Docker bind mount (locking, file paths, permissions); Docker Engine not up after reboot (no native fallback); backup and restore reliability; report card computation edge cases (ties, missing marks, coefficients); migration safety on upgrade; installer on clean Windows 10 and 11 with Docker; scope creep.
