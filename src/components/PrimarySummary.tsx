import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { num } from "@/lib/excess-recon";
import { PRIMARY_LINES, primaryLineOf, isLargeLoss, reconcilePrimaryRow, type PrimaryLine } from "@/lib/primary-recon";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { LargeLossThreshold } from "@/components/LargeLossThreshold";
import { DEFAULT_LARGE_LOSS, passesThreshold } from "@/lib/large-loss";

type Row = { id: string; data: Record<string, unknown> };
type Col = { key: string; label: string; money?: boolean };

// Columns per section, following the PLUMB Loss Run Format.
const PY_COLS: Col[] = [
  { key: "policy_effective_date", label: "Policy Effective Date" },
  { key: "policy_expiration_date", label: "Policy Expiration Date" },
  { key: "evaluation_date", label: "Evaluation Date" },
  { key: "insurer", label: "Insurer" },
  { key: "tpa", label: "TPA" },
  { key: "paid_loss", label: "Paid Loss", money: true },
  { key: "loss_reserve", label: "Loss Reserve", money: true },
  { key: "paid_alae", label: "Paid ALAE", money: true },
  { key: "alae_reserve", label: "ALAE Reserve", money: true },
  { key: "total_incurred", label: "Total Incurred", money: true },
  { key: "total_paid", label: "Total Paid", money: true },
  { key: "io_claims", label: "IO Claims" },
  { key: "non_io_claims", label: "Non-IO Claims" },
];
const LL_COLS: Col[] = [
  { key: "accident_date", label: "Accident Date" },
  { key: "report_date", label: "Report Date" },
  { key: "evaluation_date", label: "Evaluation Date" },
  { key: "description", label: "Desc" },
  { key: "paid_loss", label: "Paid Loss", money: true },
  { key: "loss_reserve", label: "Loss Reserve", money: true },
  { key: "paid_alae", label: "Paid ALAE", money: true },
  { key: "alae_reserve", label: "ALAE Reserve", money: true },
  { key: "total_incurred", label: "Total Incurred", money: true },
  { key: "total_paid", label: "Total Paid", money: true },
  { key: "status", label: "Open / Closed" },
];

// Yellow = the fields underwriters must populate in each tab of the workbook.
const ALL_PY = ["evaluation_date", "insurer", "paid_loss", "loss_reserve", "paid_alae", "alae_reserve", "total_incurred", "total_paid", "io_claims", "non_io_claims"];
const ALL_LL = ["accident_date", "report_date", "description", "paid_loss", "loss_reserve", "paid_alae", "alae_reserve", "total_incurred", "total_paid"];
const YELLOW: Record<PrimaryLine, { py: string[]; ll: string[] }> = {
  GL: { py: ALL_PY, ll: ALL_LL },
  AL: { py: ALL_PY, ll: ALL_LL },
  APD: { py: ["evaluation_date", "insurer", "total_incurred"], ll: ["accident_date", "description", "total_incurred"] },
  WC: { py: ["evaluation_date", "insurer", "total_incurred", "total_paid", "io_claims", "non_io_claims"], ll: ["accident_date", "total_incurred", "total_paid"] },
};

const usd = (v: unknown) => {
  const n = num(v);
  return n === null ? "—" : n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
};

function Section({ title, rows, cols, yellow }: { title: string; rows: Row[]; cols: Col[]; yellow: string[] }) {
  return (
    <Card>
      <CardHeader className="py-3"><CardTitle className="text-sm">{title}</CardTitle></CardHeader>
      <CardContent className="p-0 overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>#</TableHead>
              {cols.map((c) => (
                <TableHead key={c.key} className={cn("whitespace-nowrap", yellow.includes(c.key) && "bg-highlight text-highlight-foreground")}>{c.label}</TableHead>
              ))}
              <TableHead>Checks</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r, i) => {
              const rec = reconcilePrimaryRow(r.data);
              return (
                <TableRow key={r.id} className={cn(rec.issues.length > 0 && "bg-destructive/10")}>
                  <TableCell>{i + 1}</TableCell>
                  {cols.map((c) => {
                    const v = r.data[c.key];
                    const bad = rec.issues.length > 0 && (c.key === "total_incurred" || c.key === "total_paid");
                    return (
                      <TableCell key={c.key} className={cn("text-sm whitespace-nowrap", yellow.includes(c.key) && "bg-highlight/40", bad && "text-destructive font-medium")}>
                        {c.money ? usd(v) : v === null || v === undefined || v === "" ? <span className="text-muted-foreground">—</span> : String(v)}
                      </TableCell>
                    );
                  })}
                  <TableCell title={rec.issues.join("\n")}>
                    {rec.issues.length ? <Badge variant="destructive">{rec.issues.length} issue{rec.issues.length > 1 ? "s" : ""}</Badge> : <Badge variant="secondary">Ties</Badge>}
                  </TableCell>
                </TableRow>
              );
            })}
            {rows.length === 0 && (
              <TableRow><TableCell colSpan={cols.length + 2} className="text-center text-sm text-muted-foreground">No rows for this section.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export function PrimarySummary({ rows }: { rows: Row[] }) {
  const [threshold, setThreshold] = useState(DEFAULT_LARGE_LOSS);
  const byLine = new Map<PrimaryLine, Row[]>();
  for (const r of rows) {
    const l = primaryLineOf(r.data?.["coverage_line"]);
    if (!l) continue;
    byLine.set(l, [...(byLine.get(l) ?? []), { ...r, data: r.data ?? {} }]);
  }
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        One tab per product line, laid out like the PLUMB loss run format. <span className="px-1 bg-highlight text-highlight-foreground rounded">Highlighted</span> columns are the fields to paste into PLUMB.
        Each row checks Total Incurred = Paid Loss + Loss Reserve + Paid ALAE + ALAE Reserve and Total Paid = Paid Loss + Paid ALAE. Fix values in the Rows tab.
      </p>
      <LargeLossThreshold value={threshold} onChange={setThreshold} />
      <Tabs defaultValue="GL">
        <TabsList>
          {PRIMARY_LINES.map((l) => <TabsTrigger key={l} value={l}>{l} ({byLine.get(l)?.length ?? 0})</TabsTrigger>)}
        </TabsList>
        {PRIMARY_LINES.map((l) => {
          const all = byLine.get(l) ?? [];
          return (
            <TabsContent key={l} value={l} className="space-y-3">
              <Section title={`${l} — Policy years`} rows={all.filter((r) => !isLargeLoss(r.data))} cols={PY_COLS} yellow={YELLOW[l].py} />
              <Section title={`${l} — Large losses`} rows={all.filter((r) => isLargeLoss(r.data) && passesThreshold(reconcilePrimaryRow(r.data).statedIncurred ?? reconcilePrimaryRow(r.data).totalIncurred, threshold))} cols={LL_COLS} yellow={YELLOW[l].ll} />
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
