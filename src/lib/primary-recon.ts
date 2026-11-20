// Construction - Primary Casualty reconciliation (mirrors the PLUMB "Loss Run Format" workbook).
import { num, sum2, type Num } from "./excess-recon";

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

/** Total Incurred = Paid Loss + Loss Reserve + Paid ALAE + ALAE Reserve; Total Paid = Paid Loss + Paid ALAE. */
export function reconcilePrimaryRow(d: Record<string, unknown>) {
  const pl = num(d["paid_loss"]), lr = num(d["loss_reserve"]), pa = num(d["paid_alae"]), ar = num(d["alae_reserve"]);
  const totalPaid: Num = sum2(pl, pa);
  const totalIncurred: Num = sum2(sum2(pl, lr), sum2(pa, ar));
  const statedIncurred = num(d["total_incurred"]);
  const statedPaid = num(d["total_paid"]);
  const issues: string[] = [];
  const off = (a: Num, b: Num) => a !== null && b !== null && Math.abs(a - b) > 1;
  if (off(totalIncurred, statedIncurred))
    issues.push(`Total Incurred stated ${statedIncurred} but Paid Loss + Loss Reserve + Paid ALAE + ALAE Reserve = ${totalIncurred}`);
  if (off(totalPaid, statedPaid))
    issues.push(`Total Paid stated ${statedPaid} but Paid Loss + Paid ALAE = ${totalPaid}`);
  if (statedPaid !== null && statedIncurred !== null && statedPaid > statedIncurred + 1)
    issues.push(`Total Paid ${statedPaid} exceeds Total Incurred ${statedIncurred}`);
  return { totalIncurred, totalPaid, statedIncurred, statedPaid, issues };
}
