import { randomBytes } from "node:crypto";
import { CSRF_COOKIE, CSRF_HEADER } from "@sms/shared";
import type { FastifyReply, FastifyRequest } from "fastify";
import { httpError } from "../utils/http-error.js";

export function issueCsrf(reply: FastifyReply, secure: boolean): string {
  const token = randomBytes(24).toString("hex");
  void reply.setCookie(CSRF_COOKIE, token, {
    path: "/",
    httpOnly: false,
    sameSite: "lax",
    secure,
  });
  return token;
}

export function assertCsrf(request: FastifyRequest): void {
  const method = request.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return;
  const cookie = request.cookies[CSRF_COOKIE];
  const header = request.headers[CSRF_HEADER];
  const headerValue = Array.isArray(header) ? header[0] : header;
  if (!cookie || !headerValue || cookie !== headerValue) {
    throw httpError(403, "FORBIDDEN", "Invalid CSRF token");
  }
}
