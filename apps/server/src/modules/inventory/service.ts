import { createId } from "@sms/shared";
import { eq } from "drizzle-orm";
import type { DatabaseBundle } from "../../db/client.js";
import { inventoryItems, stockMovements } from "../../db/schema.js";
import { httpError } from "../../utils/http-error.js";

function nowIso(): string {
  return new Date().toISOString();
}

export function quantityOnHand(bundle: DatabaseBundle, itemId: string): number {
  return bundle.db
    .select()
    .from(stockMovements)
    .where(eq(stockMovements.itemId, itemId))
    .all()
    .reduce((sum, row) => sum + row.qty, 0);
}

export function listInventory(bundle: DatabaseBundle) {
  const items = bundle.db.select().from(inventoryItems).all();
  return items.map((item) => {
    const qty = quantityOnHand(bundle, item.id);
    return { ...item, quantity: qty, lowStock: qty <= item.minQty };
  });
}

export function createItem(
  bundle: DatabaseBundle,
  input: {
    sku: string;
    name: string;
    category: string;
    location: string;
    condition: string;
    acquiredOn: string;
    costFcfa: number;
    minQty: number;
  },
  actorUserId: string,
): { id: string } {
  const dup = bundle.db.select().from(inventoryItems).all().find((row) => row.sku.toLowerCase() === input.sku.toLowerCase());
  if (dup) throw httpError(409, "CONFLICT", "SKU already exists");
  const id = createId();
  bundle.db
    .insert(inventoryItems)
    .values({
      id,
      sku: input.sku,
      name: input.name,
      category: input.category,
      location: input.location,
      condition: input.condition,
      acquiredOn: input.acquiredOn,
      costFcfa: input.costFcfa,
      minQty: input.minQty,
      createdAt: nowIso(),
      createdBy: actorUserId,
    })
    .run();
  return { id };
}

export function recordMovement(
  bundle: DatabaseBundle,
  input: { itemId: string; direction: "in" | "out"; quantity: number; reason: string },
  actorUserId: string,
): { id: string; quantity: number } {
  const item = bundle.db.select().from(inventoryItems).where(eq(inventoryItems.id, input.itemId)).get();
  if (!item) throw httpError(404, "NOT_FOUND", "Item not found");
  const delta = input.direction === "out" ? -input.quantity : input.quantity;
  const next = quantityOnHand(bundle, item.id) + delta;
  if (next < 0) throw httpError(409, "CONFLICT", "Quantity cannot go below zero");
  const id = createId();
  bundle.db
    .insert(stockMovements)
    .values({
      id,
      itemId: item.id,
      qty: delta,
      reason: input.reason,
      createdAt: nowIso(),
      createdBy: actorUserId,
    })
    .run();
  return { id, quantity: next };
}
