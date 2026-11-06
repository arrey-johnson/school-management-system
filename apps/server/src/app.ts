import cookie from "@fastify/cookie";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import staticFiles from "@fastify/static";
import Fastify, { type FastifyInstance } from "fastify";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { AppContext } from "./app-context.js";
import type { AppEnv } from "./config/env.js";
import { openDatabase } from "./db/client.js";
import { seedFoundation } from "./db/seed.js";
import { registerAcademicRoutes } from "./modules/academic/routes.js";
import { registerAdmissionRoutes } from "./modules/admissions/routes.js";
import { registerAuthRoutes } from "./modules/auth/routes.js";
import { registerPupilRoutes } from "./modules/pupils/routes.js";
import { registerSetupRoutes } from "./modules/setup/routes.js";
import { registerSystemRoutes } from "./modules/system/routes.js";
import { registerUserRoutes } from "./modules/users/routes.js";
import { registerErrorHandler } from "./plugins/error-handler.js";
import { registerEmptyJsonBody } from "./plugins/json-body.js";

export async function buildApp(env: AppEnv, options: { logger?: boolean } = {}): Promise<{
  app: FastifyInstance;
  ctx: AppContext;
  close: () => void;
}> {
  const bundle = openDatabase(env.SMS_DATA_DIR);
  seedFoundation(bundle.db);

  const app = Fastify({
    logger: options.logger ?? env.SMS_TEST !== "1",
    trustProxy: true,
  });

  const ctx: AppContext = { env, bundle, startedAt: Date.now() };
  registerEmptyJsonBody(app);

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
  registerAcademicRoutes(app, ctx);
  registerAdmissionRoutes(app, ctx);
  registerPupilRoutes(app, ctx);

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
