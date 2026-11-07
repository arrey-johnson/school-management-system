import { APP_VERSION } from "@sms/shared";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { maybePreMigrationBackup } from "../src/modules/backup/service.js";
import { startTestApp } from "./helpers.js";

const apps: Array<{ app: { close: () => Promise<void> } }> = [];

afterEach(async () => {
  while (apps.length) {
    const item = apps.pop();
    if (item) await item.app.close();
  }
});

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

describe("installer payload and upgrades", () => {
  it("ships Compose that binds host data and never runs host Node", () => {
    const compose = fs.readFileSync(path.join(repoRoot, "installer/compose/docker-compose.yml"), "utf8");
    expect(compose).toContain("promptstack-sms:latest");
    expect(compose).toContain("ProgramData/PromptstackSMS");
    expect(compose).toContain("3847:3847");
    expect(compose).not.toMatch(/node\.exe|nssm.*node/i);
    const install = fs.readFileSync(path.join(repoRoot, "installer/Install-PromptstackSMS.ps1"), "utf8");
    expect(install).toContain("docker load");
    expect(install).toContain("docker info");
    expect(install).toContain("There is no host-Node fallback");
    const start = fs.readFileSync(path.join(repoRoot, "installer/Start-PromptstackSMS.ps1"), "utf8");
    expect(start).toContain("Wait-Docker");
    expect(start).toContain("docker compose");
    const iss = fs.readFileSync(path.join(repoRoot, "installer/promptstack-sms.iss"), "utf8");
    expect(iss).toContain("PromptstackSMS-Setup-0.8.0");
  });

  it("takes a pre-migration backup when schema.version changes", async () => {
    const built = await startTestApp();
    apps.push(built);
    built.ctx.bundle.sqlite
      .prepare("UPDATE settings SET value_json = ? WHERE key = 'schema.version'")
      .run("0.7.0");
    const result = await maybePreMigrationBackup(built.ctx.bundle);
    expect(result.ran).toBe(true);
    expect(result.to).toBe(APP_VERSION);
    const backups = fs.readdirSync(path.join(built.ctx.bundle.dataDir, "backups")).filter((f) => f.endsWith(".sms-backup"));
    expect(backups.length).toBeGreaterThan(0);
  });
});
