import { describe, expect, it } from "vitest";
import { calculatePrimaryTotals, normalizePrimaryClaimData, PRIMARY_CLAIM_FIELDS, primaryClaimValue } from "./primary-claim-fields";

describe("Primary Casualty claim-level fields", () => {
  it("uses the screenshot's 18 columns in order", () => {
    expect(PRIMARY_CLAIM_FIELDS.map((f) => f.label)).toEqual([
      "LOB", "Valuation Date", "Claim #", "Claim State", "Claim Status", "Date of Loss", "Date Reported", "Date Closed",
      "Paid Indemnity/Prop Damage", "Paid Medical/Bodily Injury", "Paid Expense",
      "Reserve Indemnity/Prop Damage", "Reserve Medical/Bodily Injury", "Reserve Expense",
      "Salvage & Subrogation Recoveries", "Total Incurred", "Carrier Name", "Loss Description",
    ]);
  });

  it("calculates gross incurred from the six paid and reserve components", () => {
    const totals = calculatePrimaryTotals({
      paid_indemnity_prop_damage: 0,
      paid_medical_bodily_injury: 2653.62,
      paid_expense: 129.28,
      reserve_indemnity_prop_damage: 12000,
      reserve_medical_bodily_injury: 28896.38,
      reserve_expense: 3420.72,
      salvage_subrogation_recoveries: 500,
    });
    expect(totals.totalPaid).toBeCloseTo(2782.9);
    expect(totals.totalIncurred).toBeCloseTo(47100);
  });

  it("keeps existing extracted rows readable through legacy field aliases", () => {
    expect(primaryClaimValue({ coverage_line: "WC" }, "lob")).toBe("WC");
    expect(primaryClaimValue({ paid_loss: 1250 }, "paid_indemnity_prop_damage")).toBe(1250);
    expect(primaryClaimValue({ insurer: "AXA XL" }, "carrier_name")).toBe("AXA XL");
  });

  it("synchronizes edited claim values into the UW-summary fields", () => {
    const row = normalizePrimaryClaimData({
      lob: "AL",
      paid_indemnity_prop_damage: 5000,
      paid_medical_bodily_injury: 1000,
      paid_expense: 250,
      reserve_indemnity_prop_damage: 4000,
      reserve_medical_bodily_injury: 500,
      reserve_expense: 100,
    });
    expect(row.coverage_line).toBe("AL");
    expect(row.paid_loss).toBe(6000);
    expect(row.loss_reserve).toBe(4500);
    expect(row.total_paid).toBe(6250);
    expect(row.total_incurred).toBe(10850);
  });
});
