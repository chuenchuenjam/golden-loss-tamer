import * as XLSX from "xlsx";

/**
 * Parse a spreadsheet file (xlsx/xls/csv) into a compact JSON preview
 * string the LLM can read. Truncates large sheets.
 */
export function spreadsheetToText(buffer: ArrayBuffer, filename: string): string {
  const wb = XLSX.read(new Uint8Array(buffer), { type: "array" });
  const out: string[] = [`# File: ${filename}`];
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
    out.push(`\n## Sheet: ${name} (${rows.length} rows)`);
    const preview = rows.slice(0, 500);
    out.push(JSON.stringify(preview));
    if (rows.length > 500) out.push(`... (${rows.length - 500} more rows truncated)`);
  }
  return out.join("\n");
}

/** List sheet names in a workbook. */
export function sheetNames(buffer: ArrayBuffer): string[] {
  const wb = XLSX.read(new Uint8Array(buffer), { type: "array" });
  return wb.SheetNames;
}

/** Text for a single sheet (by name, falling back to index). */
export function sheetToText(buffer: ArrayBuffer, sheet: string, limit = 200): string {
  const wb = XLSX.read(new Uint8Array(buffer), { type: "array" });
  const name = wb.SheetNames.includes(sheet) ? sheet : wb.SheetNames[0];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[name], { defval: "" });
  const preview = rows.slice(0, limit);
  return `## Sheet: ${name} (${rows.length} rows)\n${JSON.stringify(preview)}`;
}

/** Rough PDF page count from raw bytes. */
export function pdfPageCount(bytes: Uint8Array): number {
  let text = "";
  const chunk = 65536;
  for (let i = 0; i < bytes.byteLength; i += chunk) {
    text += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  const matches = text.match(/\/Type\s*\/Page[^s]/g);
  return matches?.length ?? 1;
}
