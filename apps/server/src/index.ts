import { loadEnv } from "./config/env.js";
import { buildApp } from "./app.js";

const env = loadEnv();
const { app } = await buildApp(env, { logger: true });

const shutdown = async () => {
  await app.close();
  process.exit(0);
};
process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());

await app.listen({ port: env.SMS_PORT, host: env.SMS_HOST });
app.log.info(`Promptstack SMS listening on http://${env.SMS_HOST}:${env.SMS_PORT}`);
