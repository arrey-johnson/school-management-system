import { CSRF_HEADER } from "@sms/shared";

type ErrorBody = { error?: { code?: string; message?: string; fields?: Array<{ message?: string }> } };

async function parse<T>(res: Response): Promise<T> {
  const data = (await res.json()) as T & ErrorBody;
  if (!res.ok) {
    const fields = (data.error?.fields ?? [])
      .map((field) => field.message)
      .filter((message): message is string => Boolean(message));
    const message = data.error?.message ?? `Request failed (${res.status})`;
    throw new Error(fields.length ? `${message}: ${fields.join("; ")}` : message);
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

export async function apiBlob(path: string): Promise<Blob> {
  const res = await fetch(path, { credentials: "include" });
  if (!res.ok) {
    throw new Error(`Download failed (${res.status})`);
  }
  return res.blob();
}

export async function apiSend<T>(path: string, method: string, body?: unknown): Promise<T> {
  const csrf = await getCsrf();
  const res = await fetch(path, {
    method,
    credentials: "include",
    headers: { "Content-Type": "application/json", [CSRF_HEADER]: csrf },
    body: JSON.stringify(body ?? {}),
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
