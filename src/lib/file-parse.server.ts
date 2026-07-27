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
