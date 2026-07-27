import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getJob, updateRow } from "@/lib/jobs.functions";
import { reconcileJob } from "@/lib/extraction.functions";
import { exportJobToExcel } from "@/lib/export.functions";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ArrowLeft, Download, RefreshCw, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/jobs/$id")({
  head: () => ({
    meta: [
      { title: "Job — Loss Run Extractor" },
      { name: "description", content: "Review extracted rows, data quality issues, and export to Excel." },
      { property: "og:title", content: "Job — Loss Run Extractor" },
      { property: "og:description", content: "Review extracted rows, data quality issues, and export to Excel." },
    ],
  }),
  component: JobDetail,
});

function JobDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const getFn = useServerFn(getJob);
  const updRow = useServerFn(updateRow);
  const recFn = useServerFn(reconcileJob);
  const expFn = useServerFn(exportJobToExcel);

  const q = useQuery({ queryKey: ["job", id], queryFn: () => getFn({ data: { id } }) });
  const [selectedFields, setSelectedFields] = useState<string[] | null>(null);
  const [downloading, setDownloading] = useState(false);

  const job = (q.data as any)?.job;
  const rows = ((q.data as any)?.rows ?? []) as any[];
  const issues = ((q.data as any)?.issues ?? []) as any[];
  const fields = ((job?.templates?.fields ?? []) as any[]);

  const issuesByRow = useMemo(() => {
    const m = new Map<string, any[]>();
    for (const iss of issues) {
      if (!iss.row_id) continue;
      const arr = m.get(iss.row_id) ?? [];
      arr.push(iss);
      m.set(iss.row_id, arr);
    }
    return m;
  }, [issues]);

  const effectiveSelected = selectedFields ?? fields.map((f) => f.key);

  const setInclude = useMutation({
    mutationFn: (p: { row_id: string; v: boolean }) => updRow({ data: { id: p.row_id, included_in_export: p.v } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["job", id] }),
  });
  const rec = useMutation({
    mutationFn: () => recFn({ data: { job_id: id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["job", id] }); toast.success("Re-reconciled"); },
  });

  async function exportExcel() {
    setDownloading(true);
    try {
      const res: any = await expFn({ data: { job_id: id, selected_fields: effectiveSelected } });
      window.open(res.url, "_blank");
    } catch (e: any) {
      toast.error(e.message);
    } finally { setDownloading(false); }
  }

  if (q.isLoading) return <div className="p-6">Loading...</div>;
  if (!job) return <div className="p-6">Not found</div>;

  const included = rows.filter((r) => r.included_in_export).length;

  return (
    <div className="p-6 max-w-none space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link to="/jobs"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" /> Back</Button></Link>
          <div>
            <h1 className="text-xl font-semibold">{job.name}</h1>
            <div className="text-xs text-muted-foreground">
              {job.clients?.name ?? "No client"} · {job.lines_of_business?.name} · {job.templates?.name} · <Badge variant="secondary">{job.status}</Badge>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => rec.mutate()} disabled={rec.isPending}><RefreshCw className="h-4 w-4 mr-1" /> Reconcile</Button>
          <Button onClick={exportExcel} disabled={downloading || included === 0}><Download className="h-4 w-4 mr-1" /> Export ({included})</Button>
        </div>
      </div>

      <Tabs defaultValue="rows">
        <TabsList>
          <TabsTrigger value="rows">Rows ({rows.length})</TabsTrigger>
          <TabsTrigger value="quality">Data quality ({issues.length})</TabsTrigger>
          <TabsTrigger value="fields">Export fields</TabsTrigger>
          <TabsTrigger value="files">Source files</TabsTrigger>
        </TabsList>

        <TabsContent value="rows">
          <Card>
            <CardContent className="p-0 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8"><Checkbox
                      checked={rows.length > 0 && rows.every((r) => r.included_in_export)}
                      onCheckedChange={(v) => rows.forEach((r) => setInclude.mutate({ row_id: r.id, v: !!v }))}
                    /></TableHead>
                    <TableHead>Issues</TableHead>
                    <TableHead>Source</TableHead>
                    {fields.map((f) => <TableHead key={f.key}>{f.label}</TableHead>)}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => {
                    const rowIssues = issuesByRow.get(r.id) ?? [];
                    const hasError = rowIssues.some((i) => i.severity === "error");
                    const hasWarn = rowIssues.some((i) => i.severity === "warning");
                    return (
                      <TableRow key={r.id} className={cn(hasError && "bg-destructive/10", !hasError && hasWarn && "bg-amber-100/40")}>
                        <TableCell><Checkbox checked={r.included_in_export} onCheckedChange={(v) => setInclude.mutate({ row_id: r.id, v: !!v })} /></TableCell>
                        <TableCell>{rowIssues.length > 0 && <Badge variant={hasError ? "destructive" : "secondary"}>{rowIssues.length}</Badge>}</TableCell>
                        <TableCell className="text-xs">{r.source_file}</TableCell>
                        {fields.map((f) => {
                          const bad = rowIssues.some((i) => i.field === f.key);
                          const v = r.data?.[f.key];
                          return (
                            <TableCell key={f.key} className={cn("text-sm", bad && "text-destructive font-medium")}>
                              {v === null || v === undefined || v === "" ? <span className="text-muted-foreground">—</span> : String(v)}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    );
                  })}
                  {rows.length === 0 && <TableRow><TableCell colSpan={fields.length + 3} className="text-center text-sm text-muted-foreground">No rows extracted.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="quality">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> Data quality issues</CardTitle></CardHeader>
            <CardContent className="space-y-1">
              {issues.map((i) => (
                <div key={i.id} className={cn("border rounded-md p-2 text-sm", i.severity === "error" ? "border-destructive/40 bg-destructive/5" : i.severity === "warning" ? "border-amber-400/40 bg-amber-100/30" : "")}>
                  <div className="flex items-center gap-2">
                    <Badge variant={i.severity === "error" ? "destructive" : "secondary"}>{i.severity}</Badge>
                    <span className="font-mono text-xs">{i.code}</span>
                    {i.field && <span className="text-xs text-muted-foreground">field: {i.field}</span>}
                  </div>
                  <div className="mt-1">{i.message}</div>
                </div>
              ))}
              {issues.length === 0 && <p className="text-sm text-muted-foreground">No issues detected.</p>}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fields">
          <Card>
            <CardHeader><CardTitle>Choose which fields to export</CardTitle></CardHeader>
            <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {fields.map((f) => (
                <label key={f.key} className="flex items-center gap-2 border rounded-md px-3 py-2">
                  <Checkbox
                    checked={effectiveSelected.includes(f.key)}
                    onCheckedChange={(v) => {
                      const next = new Set(effectiveSelected);
                      if (v) next.add(f.key); else next.delete(f.key);
                      setSelectedFields(Array.from(next));
                    }}
                  />
                  <span className="text-sm">{f.label}</span>
                </label>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="files">
          <Card>
            <CardContent className="space-y-1 pt-4">
              {((job.source_files as any[]) ?? []).map((f, i) => (
                <div key={i} className="border rounded-md px-3 py-2 text-sm flex justify-between">
                  <span>{f.name}</span><span className="text-muted-foreground">{(f.size / 1024).toFixed(0)} KB</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
