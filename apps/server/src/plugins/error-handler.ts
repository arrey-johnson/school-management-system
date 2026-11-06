import { apiError } from "@sms/shared";
import type { FastifyInstance } from "fastify";
import { ZodError } from "zod";
import { HttpError } from "../utils/http-error.js";

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((err, _request, reply) => {
    if (err instanceof HttpError) {
      return reply.status(err.statusCode).send(err.toBody());
    }
    if (err instanceof ZodError) {
      return reply.status(400).send(
        apiError(
          "VALIDATION",
          "Invalid input",
          err.issues.map((issue) => ({
            path: issue.path.join(".") || "body",
            message: issue.message,
          })),
        ),
      );
    }
    const status =
      typeof err === "object" && err && "statusCode" in err ? Number((err as { statusCode: number }).statusCode) : 500;
    const message = err instanceof Error ? err.message : "Bad request";
    if (status >= 400 && status < 500) {
      return reply.status(status).send(apiError("VALIDATION", message || "Bad request"));
    }
    requestLog(app, err);
    return reply.status(500).send(apiError("INTERNAL", "Something went wrong"));
  });
}

function requestLog(app: FastifyInstance, err: unknown): void {
  app.log.error({ err }, "unhandled error");
}
