export type ReportKind =
  | "pupils"
  | "class_register"
  | "enrolment"
  | "fee_collection"
  | "arrears"
  | "receipts"
  | "expenses"
  | "staff"
  | "payroll"
  | "attendance"
  | "academics"
  | "audit";

export const REPORT_KINDS: ReportKind[] = [
  "pupils",
  "class_register",
  "enrolment",
  "fee_collection",
  "arrears",
  "receipts",
  "expenses",
  "staff",
  "payroll",
  "attendance",
  "academics",
  "audit",
];

export function isReportKind(value: string): value is ReportKind {
  return (REPORT_KINDS as string[]).includes(value);
}

export function toExcelCsv(headers: string[], rows: Array<Array<string | number | null | undefined>>): string {
  const escape = (value: string | number | null | undefined): string => {
    const text = value == null ? "" : String(value);
    if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
    return text;
  };
  const lines = [headers.map(escape).join(","), ...rows.map((row) => row.map(escape).join(","))];
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

const MERGE_TOKEN = /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g;

export function mergeTemplate(body: string, values: Record<string, string>): string {
  return body.replace(MERGE_TOKEN, (_, key: string) => values[key] ?? "");
}
