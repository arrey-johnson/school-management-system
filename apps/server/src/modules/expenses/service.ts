import { createId } from "@sms/shared";
import { eq } from "drizzle-orm";
import type { DatabaseBundle } from "../../db/client.js";
import { academicYears, budgets, expenseCategories, expenses } from "../../db/schema.js";
import { httpError } from "../../utils/http-error.js";

function nowIso(): string {
  return new Date().toISOString();
}

export function createCategory(bundle: DatabaseBundle, name: string): { id: string } {
  const exists = bundle.db.select().from(expenseCategories).where(eq(expenseCategories.name, name)).get();
  if (exists) throw httpError(409, "CONFLICT", "Category already exists");
  const id = createId();
  bundle.db.insert(expenseCategories).values({ id, name, createdAt: nowIso() }).run();
  return { id };
}

export function setBudget(
  bundle: DatabaseBundle,
  input: { categoryId: string; academicYearId: string; amountFcfa: number },
): { id: string } {
  const existing = bundle.db
    .select()
    .from(budgets)
    .all()
    .find((row) => row.categoryId === input.categoryId && row.academicYearId === input.academicYearId);
  if (existing) {
    bundle.db.update(budgets).set({ amountFcfa: input.amountFcfa }).where(eq(budgets.id, existing.id)).run();
    return { id: existing.id };
  }
  const id = createId();
  bundle.db
    .insert(budgets)
    .values({
      id,
      categoryId: input.categoryId,
      academicYearId: input.academicYearId,
      amountFcfa: input.amountFcfa,
      createdAt: nowIso(),
    })
    .run();
  return { id };
}

export function createExpense(
  bundle: DatabaseBundle,
  input: {
    categoryId: string;
    entryDate: string;
    amountFcfa: number;
    description: string;
    vendor?: string;
    method: string;
  },
  actorUserId: string,
): { id: string; overBudget: boolean } {
  const category = bundle.db.select().from(expenseCategories).where(eq(expenseCategories.id, input.categoryId)).get();
  if (!category) throw httpError(400, "VALIDATION", "Unknown category");
  const year = bundle.db.select().from(academicYears).where(eq(academicYears.isActive, true)).get();
  const spent = bundle.db
    .select()
    .from(expenses)
    .all()
    .filter((row) => row.categoryId === input.categoryId && row.status !== "draft")
    .reduce((s, row) => s + row.amountFcfa, 0);
  const budget = year
    ? bundle.db
        .select()
        .from(budgets)
        .all()
        .find((row) => row.categoryId === input.categoryId && row.academicYearId === year.id)
    : undefined;
  const overBudget = Boolean(budget && spent + input.amountFcfa > budget.amountFcfa);
  const id = createId();
  bundle.db
    .insert(expenses)
    .values({
      id,
      categoryId: input.categoryId,
      entryDate: input.entryDate,
      amountFcfa: input.amountFcfa,
      description: input.description,
      vendor: input.vendor || null,
      method: input.method,
      status: "draft",
      createdAt: nowIso(),
      createdBy: actorUserId,
    })
    .run();
  return { id, overBudget };
}

export function submitExpense(bundle: DatabaseBundle, id: string): void {
  const row = ctxExpense(bundle, id);
  if (row.status !== "draft") throw httpError(409, "CONFLICT", "Only drafts can be submitted");
  bundle.db.update(expenses).set({ status: "submitted" }).where(eq(expenses.id, id)).run();
}

function ctxExpense(bundle: DatabaseBundle, id: string) {
  const row = bundle.db.select().from(expenses).where(eq(expenses.id, id)).get();
  if (!row) throw httpError(404, "NOT_FOUND", "Expense not found");
  return row;
}

export function approveExpense(bundle: DatabaseBundle, id: string, actorUserId: string): void {
  const row = ctxExpense(bundle, id);
  if (row.status !== "submitted") throw httpError(409, "CONFLICT", "Submit the expense first");
  if (row.createdBy === actorUserId) throw httpError(403, "FORBIDDEN", "Maker cannot approve their own expense");
  bundle.db.update(expenses).set({ status: "approved", decidedBy: actorUserId }).where(eq(expenses.id, id)).run();
}

export function payExpense(bundle: DatabaseBundle, id: string): void {
  const row = ctxExpense(bundle, id);
  if (row.status !== "approved") throw httpError(409, "CONFLICT", "Approve the expense before paying");
  bundle.db.update(expenses).set({ status: "paid" }).where(eq(expenses.id, id)).run();
}
