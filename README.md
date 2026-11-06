# Promptstack School Management

Locally installed school administration software for **ALL BRIGHT CHILDREN**, delivered by **Promptstack Technologies**.

The product name shown in the UI is **Promptstack School Management**. It runs on one Windows 10/11 school-server PC and is used from other PCs on the same LAN through a browser, with no internet required for core operation.

**Docker is mandatory** on that server: Docker Engine must start at boot, and the app runs only as Compose. If Docker is down, the system is down. There is no host-Node install path. Staff PCs still need only a browser.

## Documentation

- [Product specification](docs/SPEC.md)
- [Build plan](docs/BUILD_PLAN.md)
- [Phase 0 plan](docs/PLAN.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Decisions](docs/DECISIONS.md)

## Status

**Phase 1: foundation** (in progress on `phase-1-foundation`)

## Run locally

```bash
pnpm install
pnpm --filter @sms/shared build
pnpm dev
```

App API: `http://127.0.0.1:3847` (also proxied from Vite on `5173`).

## Run with Docker (required at the school)

```bash
docker compose up --build
```

Then open `http://localhost:3847/setup`. See [docs/DEMO.md](docs/DEMO.md).

`pnpm check` runs lint, typecheck, and unit/integration tests.
