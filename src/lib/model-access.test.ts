import { describe, it, expect } from "vitest";
import { canUseModel } from "./model-access";

const mm = { is_baseline: true, lob_id: "primary" };
const excess = { is_baseline: false, lob_id: "excess" };
describe("model rollout access", () => {
  it("makes Middle Market available by default across LoBs", () => {
    expect(canUseModel(mm, false, "excess")).toBe(true);
    expect(canUseModel(mm, false, null)).toBe(true);
  });
  it("keeps Construction unavailable until individually granted", () => {
    expect(canUseModel(excess, false, "excess")).toBe(false);
    expect(canUseModel(excess, false, "excess", true)).toBe(true);
  });
  it("allows admins to test every model", () => {
    expect(canUseModel(excess, true, null, false)).toBe(true);
  });
  it("revokes Middle Market when explicitly disabled", () => {
    expect(canUseModel(mm, false, "primary", false)).toBe(false);
  });
  it("does not grant a different Construction LoB", () => {
    expect(canUseModel(excess, false, "primary", true)).toBe(false);
  });
});