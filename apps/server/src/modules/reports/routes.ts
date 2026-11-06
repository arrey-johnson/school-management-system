import { REPORT_KINDS } from "@sms/shared";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { AppContext } from "../../app-context.js";
import { writeAudit } from "../../audit/service.js";
import { requireUser, resolveSession } from "../../auth/session.js";
import { assertReportAccess, assertReportsRead, buildReport, reportCsv, reportPdf } from "./service.js";

export function registerReportRoutes(app: FastifyInstance, ctx: AppContext): void {
  app.get("/api/v1/reports", async (req) => {
    const user = requireUser(resolveSession(ctx.bundle, req));
    assertReportsRead(user);
    return { kinds: REPORT_KINDS };
  });

  app.get("/api/v1/reports/:kind", async (req, reply) => {
    const user = requireUser(resolveSession(ctx.bundle, req));
    const { kind } = req.params as { kind: string };
    const query = z
      .object({
        format: z.enum(["json", "csv", "pdf"]).default("json"),
        classId: z.string().optional(),
      })
      .parse(req.query);
    const reportKind = assertReportAccess(user, kind, query.format !== "json");
    const table = buildReport(ctx.bundle, reportKind, user, query.classId);
    if (query.format !== "json") {
      writeAudit(ctx.bundle.db, {
        actorUserId: user.id,
        ip: req.ip,
        module: "reports",
        action: "export",
        entity: "report",
        entityId: reportKind,
        after: { format: query.format, rows: table.rows.length },
      });
    }
    if (query.format === "csv") {
      return reply
        .header("content-type", "text/csv; charset=utf-8")
        .header("content-disposition", `attachment; filename="${reportKind}.csv"`)
        .send(reportCsv(table));
    }
    if (query.format === "pdf") {
      return reply.header("content-type", "application/pdf").send(reportPdf(table));
    }
    return table;
  });
}
