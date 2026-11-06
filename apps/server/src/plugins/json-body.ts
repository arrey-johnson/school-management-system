import type { FastifyInstance } from "fastify";

/** Browsers send Content-Type: application/json on POSTs with no body (logout, finish setup). */
export function registerEmptyJsonBody(app: FastifyInstance): void {
  app.removeContentTypeParser("application/json");
  app.addContentTypeParser(
    "application/json",
    { parseAs: "string" },
    (_request, body, done) => {
      const text = typeof body === "string" ? body.trim() : "";
      if (!text) {
        done(null, {});
        return;
      }
      try {
        done(null, JSON.parse(text) as unknown);
      } catch {
        const err = new Error("Invalid JSON") as Error & { statusCode: number };
        err.statusCode = 400;
        done(err, undefined);
      }
    },
  );
}
