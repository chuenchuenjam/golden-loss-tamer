import { describe, it, expect } from "vitest";
import { reconcilePrimaryRow, primaryLineOf } from "./primary-recon";

describe("primary casualty reconciliation", () => {
  it("total incurred = paid loss + loss reserve + paid ALAE + ALAE reserve", () => {
    const r = reconcilePrimaryRow({ paid_loss: 100, loss_reserve: 50, paid_alae: 20, alae_reserve: 10, total_incurred: 180, total_paid: 120 });
    expect(r.totalIncurred).toBe(180);
    expect(r.totalPaid).toBe(120);
    expect(r.issues).toEqual([]);
  });
  it("flags a stated total incurred that does not tie", () => {
    const r = reconcilePrimaryRow({ paid_loss: 100, loss_reserve: 50, total_incurred: 200 });
    expect(r.issues.length).toBe(1);
  });
  it("blank components stay blank", () => {
    expect(reconcilePrimaryRow({}).totalIncurred).toBeNull();
  });
  it("maps coverage lines", () => {
    expect(primaryLineOf("Auto Physical Damage")).toBe("APD");
    expect(primaryLineOf("Workers Compensation")).toBe("WC");
    expect(primaryLineOf("Automobile Liability")).toBe("AL");
    expect(primaryLineOf("General Liability")).toBe("GL");
  });
});
