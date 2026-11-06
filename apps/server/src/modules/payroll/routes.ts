import {
  payrollRunCreateSchema,
  salaryComponentTypeSchema,
  salaryStructureSchema,
} from "@sms/shared";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { AppContext } from "../../app-context.js";
import { writeAudit } from "../../audit/service.js";
import { assertCsrf } from "../../auth/csrf.js";
import { requirePermission, requireUser, resolveSession } from "../../auth/session.js";
import { payrollLines, payrollRuns, salaryComponentTypes } from "../../db/schema.js";
import { httpError } from "../../utils/http-error.js";
import {
  approvePayroll,
  createAdvance,
  createAndCalculateRun,
  createComponentType,
  lockPayroll,
  markPayrollPaid,
  payslipPdf,
  requestPayrollApproval,
  saveSalaryStructure,
} from "./service.js";

export function registerPayrollRoutes(app: FastifyInstance, ctx: AppContext): void {
  app.get("/api/v1/payroll/components", async (req) => {
    const user = requireUser(resolveSession(ctx.bundle, req));
    requirePermission(user, "payroll:view");
    return { items: ctx.bundle.db.select().from(salaryComponentTypes).all() };
  });

  app.post("/api/v1/payroll/components", async (req) => {
    assertCsrf(req);
    const user = requireUser(resolveSession(ctx.bundle, req));
    requirePermission(user, "payroll:prepare");
    const body = salaryComponentTypeSchema.parse(req.body);
    return createComponentType(ctx.bundle, body);
  });

  app.post("/api/v1/payroll/structures", async (req) => {
    assertCsrf(req);
    const user = requireUser(resolveSession(ctx.bundle, req));
    requirePermission(user, "payroll:prepare");
    const body = salaryStructureSchema.parse(req.body);
    const created = saveSalaryStructure(ctx.bundle, body, user.id);
    writeAudit(ctx.bundle.db, {
      actorUserId: user.id,
      ip: req.ip,
      module: "payroll",
      action: "structure",
      entity: "salary_structure",
      entityId: created.id,
      after: { staffId: body.staffId, baseFcfa: body.baseFcfa },
    });
    return created;
  });

  app.post("/api/v1/payroll/advances", async (req) => {
    assertCsrf(req);
    const user = requireUser(resolveSession(ctx.bundle, req));
    requirePermission(user, "payroll:prepare");
    const body = z
      .object({
        staffId: z.string().min(1),
        principalFcfa: z.number().int().positive(),
        installmentFcfa: z.number().int().positive(),
      })
      .parse(req.body);
    return createAdvance(ctx.bundle, body, user.id);
  });

  app.get("/api/v1/payroll/runs", async (req) => {
    const user = requireUser(resolveSession(ctx.bundle, req));
    requirePermission(user, "payroll:view");
    const runs = ctx.bundle.db.select().from(payrollRuns).all();
    const lines = ctx.bundle.db.select().from(payrollLines).all();
    return {
      items: runs.map((run) => ({
        ...run,
        lines: lines.filter((l) => l.runId === run.id),
        totalNetFcfa: lines.filter((l) => l.runId === run.id).reduce((s, l) => s + l.netFcfa, 0),
      })),
    };
  });

  app.post("/api/v1/payroll/runs", async (req) => {
    assertCsrf(req);
    const user = requireUser(resolveSession(ctx.bundle, req));
    requirePermission(user, "payroll:prepare");
    const body = payrollRunCreateSchema.parse(req.body);
    const created = createAndCalculateRun(ctx.bundle, body.yearMonth, user.id, body.bonusFcfaByStaffId);
    writeAudit(ctx.bundle.db, {
      actorUserId: user.id,
      ip: req.ip,
      module: "payroll",
      action: "calculate",
      entity: "payroll_run",
      entityId: created.id,
      after: { yearMonth: body.yearMonth },
    });
    return created;
  });

  app.post("/api/v1/payroll/runs/:id/submit", async (req) => {
    assertCsrf(req);
    const user = requireUser(resolveSession(ctx.bundle, req));
    requirePermission(user, "payroll:prepare");
    const { id } = req.params as { id: string };
    requestPayrollApproval(ctx.bundle, id);
    return { ok: true };
  });

  app.post("/api/v1/payroll/runs/:id/approve", async (req) => {
    assertCsrf(req);
    const user = requireUser(resolveSession(ctx.bundle, req));
    requirePermission(user, "payroll:approve");
    const { id } = req.params as { id: string };
    approvePayroll(ctx.bundle, id, user.id);
    writeAudit(ctx.bundle.db, {
      actorUserId: user.id,
      ip: req.ip,
      module: "payroll",
      action: "approve",
      entity: "payroll_run",
      entityId: id,
    });
    return { ok: true };
  });

  app.post("/api/v1/payroll/runs/:id/pay", async (req) => {
    assertCsrf(req);
    const user = requireUser(resolveSession(ctx.bundle, req));
    requirePermission(user, "payroll:prepare");
    const { id } = req.params as { id: string };
    markPayrollPaid(ctx.bundle, id);
    return { ok: true };
  });

  app.post("/api/v1/payroll/runs/:id/lock", async (req) => {
    assertCsrf(req);
    const user = requireUser(resolveSession(ctx.bundle, req));
    requirePermission(user, "payroll:approve");
    const { id } = req.params as { id: string };
    lockPayroll(ctx.bundle, id);
    return { ok: true };
  });

  app.get("/api/v1/payroll/payslips/:lineId/pdf", async (req, reply) => {
    const user = requireUser(resolveSession(ctx.bundle, req));
    requirePermission(user, "payroll:view");
    const { lineId } = req.params as { lineId: string };
    const pdf = payslipPdf(ctx.bundle, lineId);
    return reply.header("content-type", "application/pdf").send(pdf);
  });

  app.get("/api/v1/payroll/runs/:id", async (req) => {
    const user = requireUser(resolveSession(ctx.bundle, req));
    requirePermission(user, "payroll:view");
    const { id } = req.params as { id: string };
    const run = ctx.bundle.db.select().from(payrollRuns).where(eq(payrollRuns.id, id)).get();
    if (!run) throw httpError(404, "NOT_FOUND", "Payroll run not found");
    const lines = ctx.bundle.db.select().from(payrollLines).where(eq(payrollLines.runId, id)).all();
    return { run, lines };
  });
}
