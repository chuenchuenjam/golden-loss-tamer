// Excess Casualty reconciliation (mirrors the Account History tab of the UW workbook).
export type Num = number | null;

export function num(v: unknown): Num {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const s = String(v).trim();
  if (!s || /^n\/?a$/i.test(s) || /not found/i.test(s)) return null;
  const neg = /^\(.*\)$/.test(s) || s.startsWith("-");
  const n = Number(s.replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(n) || s.replace(/[^0-9]/g, "") === "") return null;
  return neg ? -n : n;
}

/** Sum of two components; blank when both are blank, a blank side counts as 0 otherwise. */
export function sum2(a: Num, b: Num): Num {
  if (a === null && b === null) return null;
  return (a ?? 0) + (b ?? 0);
}

export type ReconRow = {
  coverage: string; // GL | AL | Other | Umbrella
  recordType: "Policy Year" | "Large Loss";
  policyYear: string;
  numClaims: Num;
  totalIncurred: Num;
  totalPaid: Num;
  totalReserve: Num | "N/A";
  statedIncurred: Num;
  statedPaid: Num;
  statedReserve: Num;
  prevIncurred: Num;
  changeInIncurred: Num;
  comparable: boolean;
  issues: string[];
};

export function coverageOf(v: unknown): string {
  const s = String(v ?? "").toLowerCase();
  if (/auto|\bal\b/.test(s)) return "AL";
  if (/general|\bgl\b/.test(s)) return "GL";
  if (/umb|excess/.test(s)) return "Umbrella";
  return s ? "Other" : "Other";
}

const TOL = 1;

export function reconcileRow(d: Record<string, unknown>): ReconRow {
  const ii = num(d.incurred_indemnity), ie = num(d.incurred_expense);
  const pi = num(d.paid_indemnity), pe = num(d.paid_expense);
  const statedIncurred = num(d.total_incurred), statedPaid = num(d.total_paid), statedReserve = num(d.total_reserve);
  const numClaims = num(d.num_claims);
  const totalIncurred = sum2(ii, ie) ?? statedIncurred;
  const totalPaid = sum2(pi, pe) ?? statedPaid;
  const totalReserve: Num | "N/A" =
    totalIncurred === null ? (numClaims && numClaims > 0 ? "N/A" : null) : totalIncurred - (totalPaid ?? 0);
  const prevIncurred = num(d.prev_total_incurred);
  const comparable = prevIncurred !== null;
  const changeInIncurred = comparable && totalIncurred !== null ? totalIncurred - prevIncurred! : null;

  const issues: string[] = [];
  if (statedIncurred !== null && sum2(ii, ie) !== null && Math.abs(statedIncurred - sum2(ii, ie)!) > TOL)
    issues.push(`Total Incurred ${statedIncurred} ≠ Incurred Indemnity + Expense ${sum2(ii, ie)}`);
  if (statedPaid !== null && sum2(pi, pe) !== null && Math.abs(statedPaid - sum2(pi, pe)!) > TOL)
    issues.push(`Total Paid ${statedPaid} ≠ Paid Indemnity + Expense ${sum2(pi, pe)}`);
  if (statedReserve !== null && typeof totalReserve === "number" && Math.abs(statedReserve - totalReserve) > TOL)
    issues.push(`Incurred ≠ Paid + Reserve (stated reserve ${statedReserve}, calculated ${totalReserve})`);
  if (typeof totalReserve === "number" && totalReserve < -TOL) issues.push(`Negative reserve ${totalReserve}`);

  return {
    coverage: coverageOf(d.coverage_line),
    recordType: /large/i.test(String(d.record_type ?? "")) ? "Large Loss" : "Policy Year",
    policyYear: String(d.policy_year ?? ""),
    numClaims, totalIncurred, totalPaid, totalReserve,
    statedIncurred, statedPaid, statedReserve, prevIncurred, changeInIncurred, comparable, issues,
  };
}

export type ExcessKpis = {
  avgIncurredGL: Num; avgIncurredAL: Num;
  largestGL: Num; largestAL: Num;
  totalGL: Num; totalAL: Num;
};

export function excessKpis(rows: Record<string, unknown>[]): ExcessKpis {
  const recs = rows.map(reconcileRow);
  const calc = (cov: string) => {
    const py = recs.filter((r) => r.coverage === cov && r.recordType === "Policy Year");
    const ll = recs.filter((r) => r.coverage === cov && r.recordType === "Large Loss");
    const incurredRows = py.filter((r) => r.totalIncurred !== null);
    const total = incurredRows.length ? incurredRows.reduce((a, r) => a + r.totalIncurred!, 0) : null;
    const claims = py.reduce((a, r) => a + (r.numClaims ?? 0), 0);
    const avg = total !== null && claims > 0 ? total / claims : null;
    const pool = (ll.length ? ll : py).map((r) => r.totalIncurred).filter((v): v is number => v !== null);
    const largest = pool.length ? Math.max(...pool) : null;
    return { total, avg, largest };
  };
  const gl = calc("GL"), al = calc("AL");
  return { avgIncurredGL: gl.avg, avgIncurredAL: al.avg, largestGL: gl.largest, largestAL: al.largest, totalGL: gl.total, totalAL: al.total };
}
