# Promptstack School Management

Locally installed school administration software for **ALL BRIGHT CHILDREN**, delivered by **Promptstack Technologies**.

The product name shown in the UI is **Promptstack School Management**. It runs on one Windows 10/11 school-server PC and is used from other PCs on the same LAN through a browser. Core operation does not need internet.

**Docker is mandatory** on the server: Docker Engine must start at boot, and the app runs only as Compose. If Docker is down, the system is down. There is no host-Node install path. Staff PCs need only a browser.

## Status

**Phase 8: packaging and handover** on `phase-8-packaging` (app version 0.8.0).

## School install

See [docs/INSTALL.md](docs/INSTALL.md). Short form: install Docker (start at boot), run the Inno Setup exe or `installer/Install-PromptstackSMS.ps1`, then open `http://localhost:3847/setup`.

## Documentation

- [Product specification](docs/SPEC.md)
- [Install](docs/INSTALL.md) · [Upgrade](docs/UPGRADE.md) · [User guide](docs/USER_GUIDE.md)
- [Backup and restore](docs/BACKUP_RESTORE.md)
- [Clean VM checklist](docs/CLEAN_VM.md)
- [Architecture](docs/ARCHITECTURE.md) · [Decisions](docs/DECISIONS.md)

## Develop (coding only)

```bash
docker compose up --build
```

Open `http://localhost:3847`. `pnpm dev` on the host is allowed for UI work; do not open the same SQLite file from host Node and the container at once.

`pnpm package:win` builds and `docker save`s the offline image tarball.
