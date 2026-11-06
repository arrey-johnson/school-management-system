import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  use: {
    baseURL: "http://127.0.0.1:3847",
    headless: true,
  },
  webServer: {
    command: "pnpm --filter @sms/server start",
    url: "http://127.0.0.1:3847/api/v1/setup/status",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
