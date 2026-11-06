import { inventoryItemCreateSchema, stockMovementSchema } from "@sms/shared";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import type { AppContext } from "../../app-context.js";
import { writeAudit } from "../../audit/service.js";
import { assertCsrf } from "../../auth/csrf.js";
import { requirePermission, requireUser, resolveSession } from "../../auth/session.js";
import { stockMovements } from "../../db/schema.js";
import { createItem, listInventory, recordMovement } from "./service.js";

export function registerInventoryRoutes(app: FastifyInstance, ctx: AppContext): void {
  app.get("/api/v1/inventory", async (req) => {
    const user = requireUser(resolveSession(ctx.bundle, req));
    requirePermission(user, "inventory:read");
    return { items: listInventory(ctx.bundle) };
  });

  app.get("/api/v1/inventory/:id/movements", async (req) => {
    const user = requireUser(resolveSession(ctx.bundle, req));
    requirePermission(user, "inventory:read");
    const { id } = req.params as { id: string };
    return {
      items: ctx.bundle.db.select().from(stockMovements).where(eq(stockMovements.itemId, id)).all(),
    };
  });

  app.post("/api/v1/inventory", async (req) => {
    assertCsrf(req);
    const user = requireUser(resolveSession(ctx.bundle, req));
    requirePermission(user, "inventory:manage");
    const body = inventoryItemCreateSchema.parse(req.body);
    const created = createItem(ctx.bundle, body, user.id);
    writeAudit(ctx.bundle.db, {
      actorUserId: user.id,
      ip: req.ip,
      module: "inventory",
      action: "create_item",
      entity: "inventory_item",
      entityId: created.id,
      after: { sku: body.sku, costFcfa: body.costFcfa },
    });
    return created;
  });

  app.post("/api/v1/inventory/movements", async (req) => {
    assertCsrf(req);
    const user = requireUser(resolveSession(ctx.bundle, req));
    requirePermission(user, "inventory:manage");
    const body = stockMovementSchema.parse(req.body);
    const created = recordMovement(ctx.bundle, body, user.id);
    writeAudit(ctx.bundle.db, {
      actorUserId: user.id,
      ip: req.ip,
      module: "inventory",
      action: "stock_move",
      entity: "stock_movement",
      entityId: created.id,
      after: body,
    });
    return created;
  });
}
