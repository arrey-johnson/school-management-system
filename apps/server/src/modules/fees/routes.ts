import {
  adjustmentCreateSchema,
  approvalDecideSchema,
  cashUpCloseSchema,
  feeItemCreateSchema,
  IDEMPOTENCY_HEADER,
  optionalFeeLineSchema,
  paymentCreateSchema,
  periodLockSchema,
  reversalRequestSchema,
} from "@sms/shared";
import { desc, eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import type { AppContext } from "../../app-context.js";
import { writeAudit } from "../../audit/service.js";
import { assertCsrf } from "../../auth/csrf.js";
import { requirePermission, requireUser, resolveSession } from "../../auth/session.js";
import {
  approvalRequests,
  feeItems,
  invoiceLines,
  payments,
  pupilInvoices,
  receipts,
} from "../../db/schema.js";
import { httpError } from "../../utils/http-error.js";
import { accountForInvoice } from "./ledger.js";
import {
  addOptionalLine,
  arrears,
  closeCashUp,
  createAdjustment,
  createFeeItem,
  dashboard,
  decideApproval,
  generateInvoiceForPupil,
  lockPeriod,
  receiptPdf,
  recordPayment,
  reminderText,
  requestCashUpReopen,
  requestReversal,
} from "./service.js";

function idempotencyKey(req: { headers: Record<string, unknown> }): string | undefined {
  const raw = req.headers[IDEMPOTENCY_HEADER];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function registerFeeRoutes(app: FastifyInstance, ctx: AppContext): void {
  app.get("/api/v1/fees/items", async (req) => {
    const user = requireUser(resolveSession(ctx.bundle, req));
    requirePermission(user, "payments:read");
    return { items: ctx.bundle.db.select().from(feeItems).all() };
  });

  app.post("/api/v1/fees/items", async (req) => {
    assertCsrf(req);
    const user = requireUser(resolveSession(ctx.bundle, req));
    requirePermission(user, "fees:manage");
    const body = feeItemCreateSchema.parse(req.body);
    const created = createFeeItem(ctx.bundle, body, user.id);
    writeAudit(ctx.bundle.db, {
      actorUserId: user.id,
      ip: req.ip,
      module: "fees",
      action: "create_item",
      entity: "fee_item",
      entityId: created.id,
      after: body,
    });
    return created;
  });

  app.post("/api/v1/fees/invoices/generate", async (req) => {
    assertCsrf(req);
    const user = requireUser(resolveSession(ctx.bundle, req));
    requirePermission(user, "fees:manage");
    const body = (req.body ?? {}) as { pupilId?: string };
    if (!body.pupilId) throw httpError(400, "VALIDATION", "pupilId is required");
    return generateInvoiceForPupil(ctx.bundle, body.pupilId, user.id);
  });

  app.get("/api/v1/fees/invoices", async (req) => {
    const user = requireUser(resolveSession(ctx.bundle, req));
    requirePermission(user, "payments:read");
    const pupilId =
      typeof req.query === "object" && req.query && "pupilId" in req.query ? String(req.query.pupilId) : "";
    const rows = ctx.bundle.db.select().from(pupilInvoices).all();
    const filtered = pupilId ? rows.filter((row) => row.pupilId === pupilId) : rows;
    return {
      items: filtered.map((invoice) => ({
        ...invoice,
        account: accountForInvoice(ctx.bundle, invoice.id),
      })),
    };
  });

  app.get("/api/v1/fees/invoices/:id", async (req) => {
    const user = requireUser(resolveSession(ctx.bundle, req));
    requirePermission(user, "payments:read");
    const { id } = req.params as { id: string };
    const invoice = ctx.bundle.db.select().from(pupilInvoices).where(eq(pupilInvoices.id, id)).get();
    if (!invoice) throw httpError(404, "NOT_FOUND", "Invoice not found");
    const lines = ctx.bundle.db.select().from(invoiceLines).where(eq(invoiceLines.invoiceId, id)).all();
    return { invoice, lines, account: accountForInvoice(ctx.bundle, id) };
  });

  app.post("/api/v1/fees/invoices/:id/lines", async (req) => {
    assertCsrf(req);
    const user = requireUser(resolveSession(ctx.bundle, req));
    requirePermission(user, "fees:manage");
    const { id } = req.params as { id: string };
    const body = optionalFeeLineSchema.parse(req.body);
    return addOptionalLine(ctx.bundle, id, body.feeItemId);
  });

  app.post("/api/v1/fees/adjustments", async (req) => {
    assertCsrf(req);
    const user = requireUser(resolveSession(ctx.bundle, req));
    requirePermission(user, "fees:manage");
    const body = adjustmentCreateSchema.parse(req.body);
    const created = createAdjustment(ctx.bundle, body, user.id);
    writeAudit(ctx.bundle.db, {
      actorUserId: user.id,
      ip: req.ip,
      module: "fees",
      action: "adjustment",
      entity: "adjustment",
      entityId: created.id,
      after: created,
      reason: body.reason,
    });
    return created;
  });

  app.post("/api/v1/payments", async (req) => {
    assertCsrf(req);
    const user = requireUser(resolveSession(ctx.bundle, req));
    requirePermission(user, "payments:create");
    const body = paymentCreateSchema.parse(req.body);
    const created = recordPayment(ctx.bundle, body, user.id, idempotencyKey(req));
    writeAudit(ctx.bundle.db, {
      actorUserId: user.id,
      ip: req.ip,
      module: "fees",
      action: created.replayed ? "payment_replay" : "payment",
      entity: "payment",
      entityId: created.paymentId,
      after: created,
    });
    return created;
  });

  app.get("/api/v1/payments", async (req) => {
    const user = requireUser(resolveSession(ctx.bundle, req));
    requirePermission(user, "payments:read");
    const rows = ctx.bundle.db.select().from(payments).orderBy(desc(payments.createdAt)).all();
    const receiptRows = ctx.bundle.db.select().from(receipts).all();
    return {
      items: rows.map((row) => ({
        ...row,
        receiptNumber: receiptRows.find((r) => r.paymentId === row.id)?.number ?? null,
      })),
    };
  });

  app.post("/api/v1/payments/:id/reverse", async (req) => {
    assertCsrf(req);
    const user = requireUser(resolveSession(ctx.bundle, req));
    requirePermission(user, "payments:reverse");
    const { id } = req.params as { id: string };
    const body = reversalRequestSchema.parse(req.body);
    const created = requestReversal(ctx.bundle, id, body.reason, user.id);
    writeAudit(ctx.bundle.db, {
      actorUserId: user.id,
      ip: req.ip,
      module: "fees",
      action: "reverse_request",
      entity: "payment",
      entityId: id,
      reason: body.reason,
    });
    return created;
  });

  app.get("/api/v1/approvals", async (req) => {
    const user = requireUser(resolveSession(ctx.bundle, req));
    requirePermission(user, "payments:read");
    return { items: ctx.bundle.db.select().from(approvalRequests).orderBy(desc(approvalRequests.createdAt)).all() };
  });

  app.post("/api/v1/approvals/:id/decide", async (req) => {
    assertCsrf(req);
    const user = requireUser(resolveSession(ctx.bundle, req));
    requirePermission(user, "payments:approve");
    const { id } = req.params as { id: string };
    const body = approvalDecideSchema.parse(req.body);
    const result = decideApproval(ctx.bundle, id, body.decision, user.id, body.reason);
    writeAudit(ctx.bundle.db, {
      actorUserId: user.id,
      ip: req.ip,
      module: "fees",
      action: "approval",
      entity: "approval_request",
      entityId: id,
      after: body,
    });
    return result;
  });

  app.get("/api/v1/receipts/:id/pdf", async (req, reply) => {
    const user = requireUser(resolveSession(ctx.bundle, req));
    requirePermission(user, "payments:read");
    const { id } = req.params as { id: string };
    const reprint = String((req.query as { reprint?: string }).reprint ?? "") === "1";
    const pdf = receiptPdf(ctx.bundle, id, reprint);
    return reply.header("content-type", "application/pdf").send(pdf);
  });

  app.get("/api/v1/receipts/verify/:number", async (req) => {
    const user = requireUser(resolveSession(ctx.bundle, req));
    requirePermission(user, "payments:read");
    const { number } = req.params as { number: string };
    const receipt = ctx.bundle.db.select().from(receipts).where(eq(receipts.number, number)).get();
    if (!receipt) throw httpError(404, "NOT_FOUND", "Receipt not found");
    const payment = ctx.bundle.db.select().from(payments).where(eq(payments.id, receipt.paymentId)).get();
    return { receipt, payment };
  });

  app.get("/api/v1/fees/arrears", async (req) => {
    const user = requireUser(resolveSession(ctx.bundle, req));
    requirePermission(user, "payments:read");
    return arrears(ctx.bundle);
  });

  app.get("/api/v1/fees/dashboard", async (req) => {
    const user = requireUser(resolveSession(ctx.bundle, req));
    requirePermission(user, "payments:read");
    return dashboard(ctx.bundle);
  });

  app.get("/api/v1/fees/reminders/:pupilId", async (req) => {
    const user = requireUser(resolveSession(ctx.bundle, req));
    requirePermission(user, "payments:read");
    const { pupilId } = req.params as { pupilId: string };
    return reminderText(ctx.bundle, pupilId);
  });

  app.post("/api/v1/cash-ups", async (req) => {
    assertCsrf(req);
    const user = requireUser(resolveSession(ctx.bundle, req));
    requirePermission(user, "payments:create");
    const body = cashUpCloseSchema.parse(req.body);
    const created = closeCashUp(ctx.bundle, user.id, body.day, body.countedCashFcfa, body.notes);
    writeAudit(ctx.bundle.db, {
      actorUserId: user.id,
      ip: req.ip,
      module: "fees",
      action: "cash_up",
      entity: "cash_up",
      entityId: created.id,
      after: body,
    });
    return created;
  });

  app.post("/api/v1/cash-ups/:id/reopen", async (req) => {
    assertCsrf(req);
    const user = requireUser(resolveSession(ctx.bundle, req));
    requirePermission(user, "payments:reverse");
    const { id } = req.params as { id: string };
    return requestCashUpReopen(ctx.bundle, id, user.id);
  });

  app.post("/api/v1/period-locks", async (req) => {
    assertCsrf(req);
    const user = requireUser(resolveSession(ctx.bundle, req));
    requirePermission(user, "payments:approve");
    const body = periodLockSchema.parse(req.body);
    const created = lockPeriod(ctx.bundle, body.kind, body.key, user.id);
    writeAudit(ctx.bundle.db, {
      actorUserId: user.id,
      ip: req.ip,
      module: "fees",
      action: "period_lock",
      entity: "period_lock",
      entityId: created.id,
      after: body,
    });
    return created;
  });
}
