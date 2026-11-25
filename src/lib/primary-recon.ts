// Construction - Primary Casualty reconciliation (mirrors the PLUMB "Loss Run Format" workbook).
import { num, type Num } from "./excess-recon";
import { calculatePrimaryTotals, primaryClaimValue } from "./primary-claim-fields";

export const PRIMARY_LINES = ["GL", "AL", "APD", "WC"] as const;
export type PrimaryLine = (typeof PRIMARY_LINES)[number];

export function primaryLineOf(v: unknown): PrimaryLine | null {
  const s = String(v ?? "").toLowerCase();
  if (/apd|physical/.test(s)) return "APD";
  if (/\bwc\b|workers|comp/.test(s)) return "WC";
  if (/\bal\b|auto/.test(s)) return "AL";
  if (/\bgl\b|general/.test(s)) return "GL";
  return null;
}

export function isLargeLoss(d: Record<string, unknown>) {
  return /large/i.test(String(d["record_type"] ?? ""));
}

/** Total Incurred is gross paid plus reserves; recoveries remain a separate disclosure. */
export function reconcilePrimaryRow(d: Record<string, unknown>) {
  const totals = calculatePrimaryTotals(d);
  const totalIncurred: Num = totals.totalIncurred;
  const totalPaid: Num = totals.totalPaid;
  const statedIncurred = num(d["total_incurred"]);
  const statedPaid = num(d["total_paid"]);
  const issues: string[] = [];
  const off = (a: Num, b: Num) => a !== null && b !== null && Math.abs(a - b) > 1;
  if (off(totalIncurred, statedIncurred))
    issues.push(`Total Incurred stated ${statedIncurred} but the six paid and reserve components = ${totalIncurred}`);
  if (off(totalPaid, statedPaid))
    issues.push(`Total Paid stated ${statedPaid} but Paid Indemnity/Prop Damage + Paid Medical/Bodily Injury + Paid Expense = ${totalPaid}`);
  if (statedPaid !== null && statedIncurred !== null && statedPaid > statedIncurred + 1)
    issues.push(`Total Paid ${statedPaid} exceeds Total Incurred ${statedIncurred}`);
  return { totalIncurred, totalPaid, statedIncurred, statedPaid, issues };
}

export function primaryLineOfRow(d: Record<string, unknown>) {
  return primaryLineOf(primaryClaimValue(d, "lob"));
}
