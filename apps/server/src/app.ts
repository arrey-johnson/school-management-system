import cookie from "@fastify/cookie";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import staticFiles from "@fastify/static";
import Fastify, { type FastifyInstance } from "fastify";
import fs from "node:fs";
import path from "node:path";
import { Writable } from "node:stream";
import { fileURLToPath } from "node:url";
import type { AppContext } from "./app-context.js";
import type { AppEnv } from "./config/env.js";
import { openDatabase } from "./db/client.js";
import { seedFoundation } from "./db/seed.js";
import { maybePreMigrationBackup } from "./modules/backup/service.js";
import { registerAcademicRoutes } from "./modules/academic/routes.js";
import { registerAcademicsRoutes } from "./modules/academics/routes.js";
import { registerAdminRoutes } from "./modules/admin/routes.js";
import { registerAdmissionRoutes } from "./modules/admissions/routes.js";
import { registerAttendanceRoutes } from "./modules/attendance/routes.js";
import { registerAuthRoutes } from "./modules/auth/routes.js";
import { registerBackupRoutes } from "./modules/backup/routes.js";
import { registerDashboardRoutes } from "./modules/dashboard/routes.js";
import { registerDemoRoutes } from "./modules/demo/routes.js";
import { registerExpenseRoutes } from "./modules/expenses/routes.js";
import { registerFeeRoutes } from "./modules/fees/routes.js";
import { registerInventoryRoutes } from "./modules/inventory/routes.js";
import { registerPayrollRoutes } from "./modules/payroll/routes.js";
import { registerPupilRoutes } from "./modules/pupils/routes.js";
import { registerReportRoutes } from "./modules/reports/routes.js";
import { registerSearchRoutes } from "./modules/search/routes.js";
import { registerStaffRoutes } from "./modules/staff/routes.js";
import { registerSetupRoutes } from "./modules/setup/routes.js";
import { registerSystemRoutes } from "./modules/system/routes.js";
import { registerUserRoutes } from "./modules/users/routes.js";
import { registerErrorHandler } from "./plugins/error-handler.js";
import { registerEmptyJsonBody } from "./plugins/json-body.js";
import { registerRequestId } from "./plugins/request-id.js";

export async function buildApp(env: AppEnv, options: { logger?: boolean } = {}): Promise<{
  app: FastifyInstance;
  ctx: AppContext;
  close: () => void;
}> {
  const bundle = openDatabase(env.SMS_DATA_DIR);
  seedFoundation(bundle.db);
  if (env.SMS_TEST !== "1") {
    await maybePreMigrationBackup(bundle);
  }

  const logging = options.logger ?? env.SMS_TEST !== "1";
  const logFile = path.join(env.SMS_DATA_DIR, "logs", "app.log");
  fs.mkdirSync(path.dirname(logFile), { recursive: true });
  const logStream = logging
    ? new Writable({
        write(chunk, _enc, cb) {
          process.stdout.write(chunk);
          fs.appendFile(logFile, chunk, cb);
        },
      })
    : undefined;
  const app = Fastify({
    logger: logging
      ? {
          stream: logStream,
          serializers: {
            req(request) {
              return { method: request.method, url: request.url, host: request.headers.host };
            },
          },
        }
      : false,
    trustProxy: true,
    requestIdHeader: "x-request-id",
  });

  const ctx: AppContext = { env, bundle, startedAt: Date.now() };
  registerEmptyJsonBody(app);
  registerRequestId(app);

  await app.register(helmet, {
    contentSecurityPolicy: false,
  });
  await app.register(cookie);
  await app.register(rateLimit, {
    max: env.SMS_TEST === "1" ? 10_000 : 200,
    timeWindow: "1 minute",
  });

  registerErrorHandler(app);
  registerAuthRoutes(app, ctx);
  registerSetupRoutes(app, ctx);
  registerUserRoutes(app, ctx);
  registerSystemRoutes(app, ctx);
  registerDemoRoutes(app, ctx);
  registerAcademicRoutes(app, ctx);
  registerAcademicsRoutes(app, ctx);
  registerAttendanceRoutes(app, ctx);
  registerAdmissionRoutes(app, ctx);
  registerPupilRoutes(app, ctx);
  registerFeeRoutes(app, ctx);
  registerStaffRoutes(app, ctx);
  registerPayrollRoutes(app, ctx);
  registerExpenseRoutes(app, ctx);
  registerInventoryRoutes(app, ctx);
  registerAdminRoutes(app, ctx);
  registerReportRoutes(app, ctx);
  registerSearchRoutes(app, ctx);
  registerDashboardRoutes(app, ctx);
  registerBackupRoutes(app, ctx);

  const webDist = resolveWebDist();
  if (webDist) {
    await app.register(staticFiles, {
      root: webDist,
      wildcard: false,
    });
    app.setNotFoundHandler((req, reply) => {
      if (req.url.startsWith("/api/")) {
        return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Not found" } });
      }
      return reply.sendFile("index.html");
    });
  }

  const close = () => {
    bundle.sqlite.close();
  };
  app.addHook("onClose", async () => {
    close();
  });

  return { app, ctx, close };
}

function resolveWebDist(): string | null {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.resolve(here, "../../web/dist"),
    path.resolve(here, "../../../web/dist"),
    path.resolve(process.cwd(), "apps/web/dist"),
  ];
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, "index.html"))) return dir;
  }
  return null;
}
