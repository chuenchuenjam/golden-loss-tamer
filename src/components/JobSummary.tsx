import { Card, CardContent } from "@/components/ui/card";

type Row = { data: Record<string, any>; included_in_export: boolean };
type Issue = { severity: string; row_id: string | null };

function fmtUSD(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export function JobSummary({ rows, issues }: { rows: Row[]; issues: Issue[] }) {
  const n = (v: any) => (typeof v === "number" ? v : Number(v) || 0);
  const paid = rows.reduce((a, r) => a + n(r.data.paid_indemnity) + n(r.data.paid_expense), 0);
  const reserve = rows.reduce((a, r) => a + n(r.data.reserve_indemnity) + n(r.data.reserve_expense), 0);
  const incurred = rows.reduce((a, r) => a + (n(r.data.incurred_total) || n(r.data.paid_indemnity) + n(r.data.paid_expense) + n(r.data.reserve_indemnity) + n(r.data.reserve_expense)), 0);
  const largest = rows.reduce((m, r) => Math.max(m, n(r.data.incurred_total)), 0);
  const open = rows.filter((r) => String(r.data.status ?? "").toLowerCase().startsWith("open")).length;
  const closed = rows.length - open;
  const flaggedRowIds = new Set(issues.filter((i) => i.row_id).map((i) => i.row_id));
  const flagged = flaggedRowIds.size;
  const errors = issues.filter((i) => i.severity === "error").length;

  const tiles = [
    { label: "Claims", value: String(rows.length), hint: "Total claim rows extracted" },
    { label: "Total Incurred", value: fmtUSD(incurred), hint: "Paid + Reserve. Underwriting burn." },
    { label: "Total Paid", value: fmtUSD(paid), hint: "Cash out the door." },
    { label: "Outstanding Reserve", value: fmtUSD(reserve), hint: "Expected future payments." },
    { label: "Largest Loss", value: fmtUSD(largest), hint: "Severity indicator." },
    { label: "Open / Closed", value: `${open} / ${closed}`, hint: "Open claims still developing." },
    { label: "Avg Severity", value: rows.length ? fmtUSD(Math.round(incurred / rows.length)) : "—", hint: "Incurred ÷ claim count." },
    { label: "DQ Flagged", value: `${flagged}${errors ? ` (${errors} err)` : ""}`, hint: "Rows with data quality issues." },
  ];

  return (
    <div className="grid gap-2 grid-cols-2 md:grid-cols-4">
      {tiles.map((t) => (
        <Card key={t.label}>
          <CardContent className="p-3">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{t.label}</div>
            <div className="text-lg font-semibold" title={t.hint}>{t.value}</div>
            <div className="text-[11px] text-muted-foreground truncate" title={t.hint}>{t.hint}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
