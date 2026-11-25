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
// UW summaries belong to a LoB: only access to a released LoB-specific model unlocks one.
export function canSeeUwSummary(models: (ModelAccess & { id: string })[], admin: boolean, userLob: string | null, overrides: Map<string, boolean>, jobLob: string | null): boolean {
  if (admin) return true;
  if (!jobLob) return false;
  return models.some((m) => !m.is_baseline && m.lob_id === jobLob && canUseModel(m, false, userLob, overrides.get(m.id)));
}
