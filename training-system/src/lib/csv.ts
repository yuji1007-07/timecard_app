// CSV 出力（BOM 付き UTF-8。Excel でそのまま開ける）

function esc(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function buildCsv(header: string[], rows: unknown[][]): Uint8Array {
  const text = [header, ...rows].map((r) => r.map(esc).join(",")).join("\r\n") + "\r\n";
  return new TextEncoder().encode("﻿" + text);
}

export function csvResponse(filename: string, body: Uint8Array): Response {
  return new Response(body as BodyInit, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
