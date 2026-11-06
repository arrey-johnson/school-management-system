import os from "node:os";
import path from "node:path";
import { CSRF_HEADER } from "@sms/shared";
import type { FastifyInstance, LightMyRequestResponse } from "fastify";
import { buildApp } from "../src/app.js";
import { loadEnv } from "../src/config/env.js";

export async function startTestApp() {
  const dataDir = path.join(
    os.tmpdir(),
    `sms-test-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  );
  const env = loadEnv({
    SMS_TEST: "1",
    SMS_DATA_DIR: dataDir,
    SMS_SESSION_SECRET: "test-session-secret-key",
    SMS_PORT: "3847",
  });
  const built = await buildApp(env, { logger: false });
  await built.app.ready();
  return built;
}

function cookiePairs(res: LightMyRequestResponse): string[] {
  const raw = res.headers["set-cookie"];
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return list
    .map((part) => part.split(";")[0]?.trim())
    .filter((part): part is string => Boolean(part));
}

export function mergeCookies(...parts: Array<string | string[]>): string {
  const map = new Map<string, string>();
  for (const part of parts.flat()) {
    for (const pair of part.split(";")) {
      const trimmed = pair.trim();
      if (!trimmed || !trimmed.includes("=")) continue;
      const eq = trimmed.indexOf("=");
      map.set(trimmed.slice(0, eq), trimmed.slice(eq + 1));
    }
  }
  return [...map.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

export async function csrfToken(app: FastifyInstance): Promise<{ token: string; cookie: string }> {
  const res = await app.inject({ method: "GET", url: "/api/v1/auth/csrf" });
  const body = res.json() as { csrfToken: string };
  return { token: body.csrfToken, cookie: cookiePairs(res).join("; ") };
}

export async function bootstrapAndLogin(app: FastifyInstance) {
  const csrf = await csrfToken(app);
  const boot = await app.inject({
    method: "POST",
    url: "/api/v1/setup/bootstrap",
    headers: { cookie: csrf.cookie, [CSRF_HEADER]: csrf.token },
    payload: {
      username: "admin",
      password: "ChangeMeNow1",
      displayName: "Super Admin",
    },
  });
  if (boot.statusCode !== 200) {
    throw new Error(`bootstrap ${boot.statusCode}: ${boot.body}`);
  }
  const csrf2 = await csrfToken(app);
  const login = await app.inject({
    method: "POST",
    url: "/api/v1/auth/login",
    headers: { cookie: csrf2.cookie, [CSRF_HEADER]: csrf2.token },
    payload: { username: "admin", password: "ChangeMeNow1" },
  });
  if (login.statusCode !== 200) {
    throw new Error(`login ${login.statusCode}: ${login.body}`);
  }
  const csrf3 = await csrfToken(app);
  const cookies = mergeCookies(csrf2.cookie, cookiePairs(login).join("; "), csrf3.cookie);
  return {
    cookies,
    csrf: csrf3.token,
    loginStatus: login.statusCode,
    bootStatus: boot.statusCode,
  };
}
