import { searchQuerySchema } from "@sms/shared";
import type { FastifyInstance } from "fastify";
import type { AppContext } from "../../app-context.js";
import { requirePermission, requireUser, resolveSession } from "../../auth/session.js";
import { globalSearch } from "./service.js";

export function registerSearchRoutes(app: FastifyInstance, ctx: AppContext): void {
  app.get("/api/v1/search", async (req) => {
    const user = requireUser(resolveSession(ctx.bundle, req));
    requirePermission(user, "school:read");
    const query = searchQuerySchema.parse(req.query);
    return globalSearch(ctx.bundle, user, query.q);
  });
}
