import type { FastifyInstance } from "fastify";

export function registerRequestId(app: FastifyInstance): void {
  app.addHook("onRequest", async (req, reply) => {
    reply.header("x-request-id", req.id);
  });
}
