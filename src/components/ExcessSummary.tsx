import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { excessKpis, reconcileRow, type Num } from "@/lib/excess-recon";
import { cn } from "@/lib/utils";

const usd = (n: Num | "N/A") =>
  n === "N/A" ? "N/A" : n === null ? "—" : n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

type Row = { data: Record<string, unknown> };

export function ExcessKpiCards({ rows }: { rows: Row[] }) {
  const k = excessKpis(rows.map((r) => r.data ?? {}));
  const tiles = [
    ["Average Total Incurred: GL", k.avgIncurredGL, "GL total incurred ÷ GL claim count"],
    ["Average Total Incurred: AL", k.avgIncurredAL, "AL total incurred ÷ AL claim count"],
    ["Largest GL Claim", k.largestGL, "Largest single GL loss"],
    ["Largest AL Claim", k.largestAL, "Largest single AL loss"],
    ["Total Claims: GL", k.totalGL, "Sum of GL total incurred"],
    ["Total Claims: AL", k.totalAL, "Sum of AL total incurred"],
  ] as const;
  return (
    <div className="grid gap-2 grid-cols-2 md:grid-cols-3">
      {tiles.map(([label, v, hint]) => (
        <Card key={label}>
          <CardContent className="p-3">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
            <div className="text-lg font-semibold">{usd(v)}</div>
            <div className="text-[11px] text-muted-foreground truncate">{hint}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

const COVERAGES = [
  ["GL", "General Liability"],
  ["AL", "Automobile Liability"],
  ["Other", "Other Liability"],
  ["Umbrella", "Umbrella (losses already included in primary)"],
] as const;

export function UWSummary({ rows }: { rows: Row[] }) {
  const recs = rows.map((r) => ({ d: r.data ?? {}, r: reconcileRow(r.data ?? {}) }));
  const sections = COVERAGES.flatMap(([cov, title]) =>
    (["Policy Year", "Large Loss"] as const).map((type) => ({
      title: type === "Large Loss" ? `Large Losses — ${title}` : title,
      type,
      items: recs.filter((x) => x.r.coverage === cov && x.r.recordType === type).sort((a, b) => b.r.policyYear.localeCompare(a.r.policyYear)),
    })),
  ).filter((s) => s.items.length > 0);

  return (
    <div className="space-y-4">
      <div className="rounded-md border p-2 text-xs text-muted-foreground">
        Reconciled as: Total Incurred = Incurred Indemnity + Incurred Expense · Total Paid = Paid Indemnity + Paid Expense · Total Reserve = Total Incurred − Total Paid · Change in Incurred = Current − Previous (shown only when a prior valuation was supplied). Cells in red don't tie to the loss run.
      </div>
      {sections.length === 0 && <p className="text-sm text-muted-foreground">No policy-year or large-loss rows extracted yet.</p>}
      {sections.map((s) => (
        <Card key={s.title}>
          <CardHeader className="pb-2"><CardTitle className="text-base">{s.title}</CardTitle></CardHeader>
          <CardContent className="p-0 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Policy Year</TableHead>
                  {s.type === "Policy Year" ? <TableHead># Claims</TableHead> : <><TableHead>Acc Date</TableHead><TableHead>Status</TableHead><TableHead>Description</TableHead></>}
                  <TableHead>Valuation</TableHead>
                  <TableHead>Insurer</TableHead>
                  <TableHead className="text-right">Total Incurred</TableHead>
                  <TableHead className="text-right">Total Paid</TableHead>
                  <TableHead className="text-right">Total Reserve</TableHead>
                  <TableHead className="text-right">Previous Incurred</TableHead>
                  <TableHead className="text-right">Change in Incurred</TableHead>
                  <TableHead>Checks</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {s.items.map(({ d, r }, i) => (
                  <TableRow key={i} className={cn(r.issues.length > 0 && "bg-destructive/5")}>
                    <TableCell>{r.policyYear || "—"}</TableCell>
                    {s.type === "Policy Year" ? <TableCell>{r.numClaims ?? "—"}</TableCell> : <>
                      <TableCell>{String(d.accident_date ?? "—")}</TableCell>
                      <TableCell>{String(d.status ?? "—")}</TableCell>
                      <TableCell className="max-w-[220px] truncate" title={String(d.description ?? "")}>{String(d.description ?? "—")}</TableCell>
                    </>}
                    <TableCell>{String(d.valuation_date ?? "—")}</TableCell>
                    <TableCell>{String(d.insurer ?? "—")}</TableCell>
                    <TableCell className={cn("text-right", r.issues.some((x) => x.startsWith("Total Incurred")) && "text-destructive font-medium")}>{usd(r.totalIncurred)}</TableCell>
                    <TableCell className={cn("text-right", r.issues.some((x) => x.startsWith("Total Paid")) && "text-destructive font-medium")}>{usd(r.totalPaid)}</TableCell>
                    <TableCell className={cn("text-right", r.issues.some((x) => /Reserve|reserve/.test(x)) && "text-destructive font-medium")}>{usd(r.totalReserve)}</TableCell>
                    <TableCell className="text-right">{r.comparable ? usd(r.prevIncurred) : <span className="text-muted-foreground text-xs">N/A – prior valuation not supplied</span>}</TableCell>
                    <TableCell className="text-right">{r.comparable ? usd(r.changeInIncurred) : "—"}</TableCell>
                    <TableCell>
                      {r.issues.length === 0 ? <Badge variant="secondary">Ties</Badge> :
                        <Badge variant="destructive" title={r.issues.join("\n")}>{r.issues.length} issue{r.issues.length > 1 ? "s" : ""}</Badge>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
