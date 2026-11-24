export type ModelAccess = { is_baseline: boolean; lob_id: string | null };

// Explicit decisions override the baseline default; LoB assignment is not a grant.
export function canUseModel(model: ModelAccess, admin: boolean, userLob: string | null, override?: boolean): boolean {
  if (admin) return true;
  if (!model.is_baseline && (!userLob || model.lob_id !== userLob)) return false;
  return override ?? model.is_baseline;
}

export function modelAvailability(model: ModelAccess, available: boolean): string {
  if (available) return "Available";
  return model.is_baseline ? "Access not assigned" : "Releasing mid-Jan 2027";
}