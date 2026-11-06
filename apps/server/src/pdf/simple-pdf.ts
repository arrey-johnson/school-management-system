function escapePdf(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

export function buildTextPdf(title: string, lines: string[]): Buffer {
  const ops: string[] = [`BT /F1 16 Tf 48 800 Td (${escapePdf(title)}) Tj ET`];
  lines.forEach((line, index) => {
    ops.push(`BT /F1 11 Tf 48 ${772 - index * 16} Td (${escapePdf(line)}) Tj ET`);
  });
  const stream = ops.join("\n");
  const objects = [
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
    "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj",
    `4 0 obj << /Length ${Buffer.byteLength(stream)} >> stream\n${stream}\nendstream endobj`,
    "5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj",
  ];
  let offset = 9;
  const xref: number[] = [0];
  const chunks = ["%PDF-1.4\n"];
  for (const obj of objects) {
    xref.push(offset);
    chunks.push(`${obj}\n`);
    offset += Buffer.byteLength(`${obj}\n`);
  }
  const xrefStart = offset;
  const xrefTable = [
    "xref",
    `0 ${objects.length + 1}`,
    "0000000000 65535 f ",
    ...xref.slice(1).map((n) => `${n.toString().padStart(10, "0")} 00000 n `),
    "trailer << /Size " + (objects.length + 1) + " /Root 1 0 R >>",
    "startxref",
    String(xrefStart),
    "%%EOF",
  ].join("\n");
  chunks.push(xrefTable);
  return Buffer.concat(chunks.map((c) => Buffer.from(c)));
}
