import { CSRF_HEADER } from "@sms/shared";

type ErrorBody = { error?: { code?: string; message?: string } };

async function parse<T>(res: Response): Promise<T> {
  const data = (await res.json()) as T & ErrorBody;
  if (!res.ok) {
    throw new Error(data.error?.message ?? `Request failed (${res.status})`);
  }
  return data;
}

export async function getCsrf(): Promise<string> {
  const res = await fetch("/api/v1/auth/csrf", { credentials: "include" });
  const data = await parse<{ csrfToken: string }>(res);
  return data.csrfToken;
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(path, { credentials: "include" });
  return parse<T>(res);
}

export async function apiSend<T>(path: string, method: string, body?: unknown): Promise<T> {
  const csrf = await getCsrf();
  const res = await fetch(path, {
    method,
    credentials: "include",
    headers: { "Content-Type": "application/json", [CSRF_HEADER]: csrf },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return parse<T>(res);
}

export type MeUser = {
  id: string;
  username: string;
  displayName: string;
  roleSlug: string;
  roleName: string;
  locale: string;
  mustChangePassword: boolean;
  permissions: string[];
};
