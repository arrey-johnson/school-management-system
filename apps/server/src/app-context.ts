import type { AppEnv } from "./config/env.js";
import type { DatabaseBundle } from "./db/client.js";

export type AppContext = {
  env: AppEnv;
  bundle: DatabaseBundle;
  startedAt: number;
};
