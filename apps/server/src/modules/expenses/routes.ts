import { budgetCreateSchema, expenseCategorySchema, expenseCreateSchema } from "@sms/shared";
import type { FastifyInstance } from "fastify";
import type { AppContext } from "../../app-context.js";
import { writeAudit } from "../../audit/service.js";
import { assertCsrf } from "../../auth/csrf.js";
import { requirePermission, requireUser, resolveSession } from "../../auth/session.js";
import { budgets, expenseCategories, expenses } from "../../db/schema.js";
import {
  approveExpense,
  createCategory,
  createExpense,
  payExpense,
  setBudget,
  submitExpense,
} from "./service.js";

export function registerExpenseRoutes(app: FastifyInstance, ctx: AppContext): void {
  app.get("/api/v1/expenses/categories", async (req) => {
    const user = requireUser(resolveSession(ctx.bundle, req));
    requirePermission(user, "expenses:read");
    return { items: ctx.bundle.db.select().from(expenseCategories).all() };
  });

  app.post("/api/v1/expenses/categories", async (req) => {
    assertCsrf(req);
    const user = requireUser(resolveSession(ctx.bundle, req));
    requirePermission(user, "expenses:manage");
    const body = expenseCategorySchema.parse(req.body);
    return createCategory(ctx.bundle, body.name);
  });

  app.post("/api/v1/expenses/budgets", async (req) => {
    assertCsrf(req);
    const user = requireUser(resolveSession(ctx.bundle, req));
    requirePermission(user, "expenses:manage");
    const body = budgetCreateSchema.parse(req.body);
    return setBudget(ctx.bundle, body);
  });

  app.get("/api/v1/expenses/budgets", async (req) => {
    const user = requireUser(resolveSession(ctx.bundle, req));
    requirePermission(user, "expenses:read");
    return { items: ctx.bundle.db.select().from(budgets).all() };
  });

  app.get("/api/v1/expenses", async (req) => {
    const user = requireUser(resolveSession(ctx.bundle, req));
    requirePermission(user, "expenses:read");
    return { items: ctx.bundle.db.select().from(expenses).all() };
  });

  app.post("/api/v1/expenses", async (req) => {
    assertCsrf(req);
    const user = requireUser(resolveSession(ctx.bundle, req));
    requirePermission(user, "expenses:manage");
    const body = expenseCreateSchema.parse(req.body);
    const created = createExpense(ctx.bundle, body, user.id);
    writeAudit(ctx.bundle.db, {
      actorUserId: user.id,
      ip: req.ip,
      module: "expenses",
      action: "create",
      entity: "expense",
      entityId: created.id,
      after: created,
    });
    return created;
  });

  app.post("/api/v1/expenses/:id/submit", async (req) => {
    assertCsrf(req);
    const user = requireUser(resolveSession(ctx.bundle, req));
    requirePermission(user, "expenses:manage");
    const { id } = req.params as { id: string };
    submitExpense(ctx.bundle, id);
    return { ok: true };
  });

  app.post("/api/v1/expenses/:id/approve", async (req) => {
    assertCsrf(req);
    const user = requireUser(resolveSession(ctx.bundle, req));
    requirePermission(user, "expenses:approve");
    const { id } = req.params as { id: string };
    approveExpense(ctx.bundle, id, user.id);
    return { ok: true };
  });

  app.post("/api/v1/expenses/:id/pay", async (req) => {
    assertCsrf(req);
    const user = requireUser(resolveSession(ctx.bundle, req));
    requirePermission(user, "expenses:manage");
    const { id } = req.params as { id: string };
    payExpense(ctx.bundle, id);
    return { ok: true };
  });
}
