export const LARGE_LOSS_THRESHOLDS = [0, 100_000, 250_000, 500_000, 600_000, 650_000, 700_000, 750_000, 800_000, 850_000, 900_000, 950_000, 1_000_000, 2_000_000, 5_000_000];
export const DEFAULT_LARGE_LOSS = 100_000;
/** A large loss is shown when its total incurred is above the threshold; 0 shows every large loss. */
export function passesThreshold(totalIncurred: number | null, threshold: number) {
  if (threshold <= 0) return true;
  return totalIncurred !== null && totalIncurred > threshold;
}
