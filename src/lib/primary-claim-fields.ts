import { num, type Num } from "./excess-recon";

export type PrimaryClaimField = {
  key: string;
  label: string;
  type: "string" | "number" | "date";
  required: boolean;
  hint: string;
  aliases?: readonly string[];
};

/** The 18 claim-level columns in the carrier loss-ingestion workbook. */
export const PRIMARY_CLAIM_FIELDS: readonly PrimaryClaimField[] = [
  { key: "lob", label: "LOB", type: "string", required: true, aliases: ["coverage_line"], hint: "Coverage for this row: GL, AL, APD or WC. Use the row-level product/coverage value, not the file name." },
  { key: "valuation_date", label: "Valuation Date", type: "date", required: false, aliases: ["evaluation_date"], hint: "The loss-run as-of, valuation or evaluation date for this row, formatted YYYY-MM-DD." },
  { key: "claim_number", label: "Claim #", type: "string", required: false, hint: "The carrier's unique claim number exactly as printed. Leave null for aggregate policy-year rows." },
  { key: "claim_state", label: "Claim State", type: "string", required: false, hint: "The claim jurisdiction or accident state, normally a two-letter state code. Do not confuse this with claim status." },
  { key: "claim_status", label: "Claim Status", type: "string", required: false, aliases: ["status"], hint: "Open, Closed or Reopened as reported for this claim at the valuation date." },
  { key: "date_of_loss", label: "Date of Loss", type: "date", required: false, aliases: ["accident_date"], hint: "Accident or loss occurrence date, formatted YYYY-MM-DD." },
  { key: "date_reported", label: "Date Reported", type: "date", required: false, aliases: ["report_date"], hint: "Date the claim was reported to the carrier, formatted YYYY-MM-DD." },
  { key: "date_closed", label: "Date Closed", type: "date", required: false, hint: "Date the claim closed, formatted YYYY-MM-DD. Use null for open claims or when not reported." },
  { key: "paid_indemnity_prop_damage", label: "Paid Indemnity/Prop Damage", type: "number", required: false, aliases: ["paid_loss"], hint: "Paid indemnity or property damage in USD, excluding medical/bodily injury and expense. Use 0 for an explicit zero and null when not reported." },
  { key: "paid_medical_bodily_injury", label: "Paid Medical/Bodily Injury", type: "number", required: false, hint: "Paid medical or bodily-injury loss in USD, excluding indemnity/property damage and expense. Do not invent a split when the source only reports one combined paid-loss amount." },
  { key: "paid_expense", label: "Paid Expense", type: "number", required: false, aliases: ["paid_alae"], hint: "Paid claim expense or ALAE in USD. Exclude paid loss, medical and indemnity amounts." },
  { key: "reserve_indemnity_prop_damage", label: "Reserve Indemnity/Prop Damage", type: "number", required: false, aliases: ["loss_reserve"], hint: "Outstanding indemnity or property-damage reserve in USD, excluding medical/bodily injury and expense reserves." },
  { key: "reserve_medical_bodily_injury", label: "Reserve Medical/Bodily Injury", type: "number", required: false, hint: "Outstanding medical or bodily-injury reserve in USD. Do not invent a split when the source only reports one combined loss reserve." },
  { key: "reserve_expense", label: "Reserve Expense", type: "number", required: false, aliases: ["alae_reserve"], hint: "Outstanding claim expense or ALAE reserve in USD." },
  { key: "salvage_subrogation_recoveries", label: "Salvage & Subrogation Recoveries", type: "number", required: false, hint: "Salvage and subrogation recoveries in USD, reported separately. Do not subtract these from the stated gross Total Incurred." },
  { key: "total_incurred", label: "Total Incurred", type: "number", required: false, hint: "Reported gross Total Incurred in USD. If absent, the app calculates paid indemnity/property + paid medical/BI + paid expense + all three corresponding reserves." },
  { key: "carrier_name", label: "Carrier Name", type: "string", required: false, aliases: ["insurer"], hint: "Carrier or insurer issuing the policy and reporting the claim, not the insured, claimant, broker or TPA." },
  { key: "loss_description", label: "Loss Description", type: "string", required: false, aliases: ["description"], hint: "Concise accident, injury or damage description from the claim narrative or cause-of-loss field." },
];

const missing = (v: unknown) => v === null || v === undefined || v === "";

export function primaryClaimValue(data: Record<string, unknown>, key: string): unknown {
  if (!missing(data[key])) return data[key];
  const field = PRIMARY_CLAIM_FIELDS.find((f) => f.key === key);
  for (const alias of field?.aliases ?? []) {
    if (!missing(data[alias])) return data[alias];
  }
  return data[key];
}

function sumKnown(values: Num[]): Num {
  const present = values.filter((v): v is number => v !== null);
  return present.length ? present.reduce((a, b) => a + b, 0) : null;
}

export function primaryAmounts(data: Record<string, unknown>) {
  return {
    paidIndemnity: num(primaryClaimValue(data, "paid_indemnity_prop_damage")),
    paidMedical: num(primaryClaimValue(data, "paid_medical_bodily_injury")),
    paidExpense: num(primaryClaimValue(data, "paid_expense")),
    reserveIndemnity: num(primaryClaimValue(data, "reserve_indemnity_prop_damage")),
    reserveMedical: num(primaryClaimValue(data, "reserve_medical_bodily_injury")),
    reserveExpense: num(primaryClaimValue(data, "reserve_expense")),
  };
}

export function calculatePrimaryTotals(data: Record<string, unknown>) {
  const a = primaryAmounts(data);
  return {
    paidLoss: sumKnown([a.paidIndemnity, a.paidMedical]),
    lossReserve: sumKnown([a.reserveIndemnity, a.reserveMedical]),
    totalPaid: sumKnown([a.paidIndemnity, a.paidMedical, a.paidExpense]),
    totalIncurred: sumKnown([a.paidIndemnity, a.paidMedical, a.paidExpense, a.reserveIndemnity, a.reserveMedical, a.reserveExpense]),
  };
}

/** Keep the 18 claim columns and the existing UW-summary fields synchronized. */
export function normalizePrimaryClaimData(data: Record<string, unknown>) {
  const next: Record<string, unknown> = { ...data };
  for (const field of PRIMARY_CLAIM_FIELDS) {
    const value = primaryClaimValue(data, field.key);
    if (!missing(value)) next[field.key] = value;
  }

  const copy = (from: string, to: string) => {
    if (!missing(next[from])) next[to] = next[from];
  };
  copy("lob", "coverage_line");
  copy("valuation_date", "evaluation_date");
  copy("date_of_loss", "accident_date");
  copy("date_reported", "report_date");
  copy("claim_status", "status");
  copy("carrier_name", "insurer");
  copy("loss_description", "description");

  const totals = calculatePrimaryTotals(next);
  if (totals.paidLoss !== null) next.paid_loss = totals.paidLoss;
  if (totals.lossReserve !== null) next.loss_reserve = totals.lossReserve;
  if (!missing(next.paid_expense)) next.paid_alae = num(next.paid_expense);
  if (!missing(next.reserve_expense)) next.alae_reserve = num(next.reserve_expense);
  if (totals.totalPaid !== null) next.total_paid = totals.totalPaid;
  if (missing(next.total_incurred) && totals.totalIncurred !== null) next.total_incurred = totals.totalIncurred;
  return next;
}

export function primaryModelFields() {
  return PRIMARY_CLAIM_FIELDS.map(({ aliases: _aliases, ...field }) => ({ ...field, value: "" }));
}
