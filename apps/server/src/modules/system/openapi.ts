import { APP_VERSION } from "@sms/shared";

export function openApiDocument(): Record<string, unknown> {
  return {
    openapi: "3.0.3",
    info: { title: "Promptstack School Management", version: APP_VERSION },
    paths: {
      "/api/v1/auth/login": { post: { summary: "Sign in" } },
      "/api/v1/backups": { get: { summary: "List backups" }, post: { summary: "Create backup" } },
      "/api/v1/backups/restore": { post: { summary: "Restore backup" } },
      "/api/v1/system/health": { get: { summary: "Health" } },
    },
  };
}
