import { describe, it, expect } from "vitest";
import { passesThreshold } from "./large-loss";
describe("large loss threshold", () => {
  it("shows losses above the threshold only", () => {
    expect(passesThreshold(1_448_000, 1_000_000)).toBe(true);
    expect(passesThreshold(100_000, 100_000)).toBe(false);
    expect(passesThreshold(250_000, 100_000)).toBe(true);
  });
  it("show all includes everything", () => { expect(passesThreshold(null, 0)).toBe(true); });
});
