import { describe, it, expect } from "vitest";
import { reconcileRow, excessKpis, sum2 } from "./excess-recon";

describe("excess casualty reconciliation", () => {
  it("total incurred = incurred indemnity + incurred expense", () => {
    expect(reconcileRow({ incurred_indemnity: "195,000", incurred_expense: "10,000" }).totalIncurred).toBe(205000);
  });
  it("blank when both components blank", () => {
    expect(sum2(null, null)).toBeNull();
  });
  it("reserve = incurred - paid", () => {
    const r = reconcileRow({ incurred_indemnity: 195000, incurred_expense: 10000, paid_indemnity: 16569, paid_expense: 3841 });
    expect(r.totalReserve).toBe(184590);
  });
  it("reserve N/A when incurred blank but claims exist", () => {
    expect(reconcileRow({ num_claims: 3 }).totalReserve).toBe("N/A");
  });
  it("missing previous valuation is not treated as zero", () => {
    const r = reconcileRow({ incurred_indemnity: 205000 });
    expect(r.comparable).toBe(false);
    expect(r.changeInIncurred).toBeNull();
  });
  it("change in incurred = current - previous", () => {
    expect(reconcileRow({ incurred_indemnity: 86430, prev_total_incurred: 78602 }).changeInIncurred).toBe(7828);
  });
  it("flags incurred != paid + reserve", () => {
    const r = reconcileRow({ incurred_indemnity: 100, paid_indemnity: 40, total_reserve: 10 });
    expect(r.issues.length).toBe(1);
  });
  it("KPIs per GL and AL", () => {
    const k = excessKpis([
      { record_type: "Policy Year", coverage_line: "General Liability", num_claims: 5, incurred_indemnity: 200000 },
      { record_type: "Policy Year", coverage_line: "GL", num_claims: 5, incurred_indemnity: 100000 },
      { record_type: "Large Loss", coverage_line: "GL", incurred_indemnity: 675000, incurred_expense: 84758 },
      { record_type: "Policy Year", coverage_line: "Automobile Liability", num_claims: 2, incurred_indemnity: 50000 },
    ]);
    expect(k.totalGL).toBe(300000);
    expect(k.avgIncurredGL).toBe(30000);
    expect(k.largestGL).toBe(759758);
    expect(k.totalAL).toBe(50000);
    expect(k.largestAL).toBe(50000);
  });
});
