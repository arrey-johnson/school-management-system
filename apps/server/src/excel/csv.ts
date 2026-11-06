import { toExcelCsv } from "@sms/shared";

export function excelCsvBuffer(headers: string[], rows: Array<Array<string | number | null | undefined>>): Buffer {
  return Buffer.from(toExcelCsv(headers, rows), "utf8");
}
