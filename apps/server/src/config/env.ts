import { DEFAULT_PORT } from "@sms/shared";
import { z } from "zod";

const envSchema = z.object({
  SMS_PORT: z.coerce.number().int().min(1).default(DEFAULT_PORT),
  SMS_HOST: z.string().default("0.0.0.0"),
  SMS_DATA_DIR: z.string().default(".data"),
  SMS_SESSION_SECRET: z.string().min(16).default("dev-only-change-me-session"),
  SMS_DEMO: z.enum(["0", "1"]).default("0"),
  SMS_BOOTSTRAP_USERNAME: z.string().default("admin"),
  SMS_BOOTSTRAP_PASSWORD: z.string().optional(),
  SMS_TEST: z.enum(["0", "1"]).default("0"),
  NODE_ENV: z.string().optional(),
});

export type AppEnv = z.infer<typeof envSchema>;

export function loadEnv(overrides: Record<string, string | undefined> = {}): AppEnv {
  return envSchema.parse({ ...process.env, ...overrides });
}
