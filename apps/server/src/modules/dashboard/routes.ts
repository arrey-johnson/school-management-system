import type { FastifyInstance } from "fastify";
import type { AppContext } from "../../app-context.js";
import { requirePermission, requireUser, resolveSession } from "../../auth/session.js";
import { roleDashboard } from "./service.js";

export function registerDashboardRoutes(app: FastifyInstance, ctx: AppContext): void {
  app.get("/api/v1/dashboard", async (req) => {
    const user = requireUser(resolveSession(ctx.bundle, req));
    requirePermission(user, "school:read");
    return roleDashboard(ctx.bundle, user);
  });
}
