import { createFileRoute, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { listJobs } from "@/lib/jobs.functions";
import { seedDemoData } from "@/lib/demo.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileStack, Sparkles, BookOpen, Search } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Loss Run Extractor" },
      { name: "description", content: "Your loss run extraction workspace." },
      { property: "og:title", content: "Dashboard — Loss Run Extractor" },
      { property: "og:description", content: "Your loss run extraction workspace." },
    ],
  }),
  component: Dashboard,
});

function fmtUSD(n: number) {
  if (!Number.isFinite(n) || n === 0) return "$0";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function Dashboard() {
  const fetch = useServerFn(listJobs);
  const seed = useServerFn(seedDemoData);
  const qc = useQueryClient();
  const { data: jobs = [] } = useQuery({ queryKey: ["jobs"], queryFn: () => fetch() });

  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data } = await supabase.rpc("has_role", { _user_id: u.user.id, _role: "admin" });
      setIsAdmin(!!data);
    })();
  }, []);

  const seedM = useMutation({
    mutationFn: () => seed(),
    onSuccess: (res: any) => {
      if (res?.skipped) toast.info("Demo data already loaded.");
      else toast.success(`Loaded ${res.jobs} demo jobs across ${res.clients} clients.`);
      qc.invalidateQueries({ queryKey: ["jobs"] });
      qc.invalidateQueries({ queryKey: ["clients"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const byStatus = (jobs as any[]).reduce<Record<string, number>>((acc, j) => {
    acc[j.status] = (acc[j.status] ?? 0) + 1;
    return acc;
  }, {});

  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "ready" | "in progress" | "error">("all");

  const needle = q.trim().toLowerCase();
  const filtered = (jobs as any[]).filter((j) => {
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "ready" && j.status === "ready") ||
      (statusFilter === "error" && j.status === "error") ||
      (statusFilter === "in progress" && !["ready", "error"].includes(j.status));
    if (!matchesStatus) return false;
    if (!needle) return true;
    const hay = [j.name, j.clients?.name, j.lines_of_business?.name, j.templates?.name, j.status]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return hay.includes(needle);
  });

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Underwriter workspace</h1>
          <p className="text-sm text-muted-foreground">Turn carrier loss run documents into clean, reconciled data ready for pricing and risk analysis.</p>
        </div>
        {isAdmin && jobs.length === 0 && (
          <Button onClick={() => seedM.mutate()} disabled={seedM.isPending}>
            <Sparkles className="h-4 w-4 mr-1" /> Load demo data
          </Button>
        )}
        {isAdmin && jobs.length > 0 && (
          <Button variant="outline" onClick={() => seedM.mutate()} disabled={seedM.isPending}>
            <Sparkles className="h-4 w-4 mr-1" /> Load demo data
          </Button>
        )}
      </div>

      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2"><BookOpen className="h-4 w-4" /> How to use this platform</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          <ol className="list-decimal ml-5 space-y-1">
            <li><b>Pick or create a template</b> per line of business. Mark your firm's preferred one as the <em>golden source</em> so every extraction uses the same field schema.</li>
            <li><b>Upload the carrier's loss run</b> (PDF, XLSX, CSV) under the correct client. The AI extracts every claim into the template's fields.</li>
            <li><b>Review data quality flags</b> — missing dates, negative reserves, duplicate claim numbers, adverse development. Fix or accept before pricing.</li>
            <li><b>Select rows and fields</b> that matter for your analysis, then <b>export to Excel</b> for triangle building, frequency/severity, and reserve adequacy.</li>
          </ol>
          <p className="text-xs text-muted-foreground">
            Interpretation: <b>Total Incurred</b> = burn to date. <b>Outstanding Reserve</b> = carrier's estimate of what's still to pay. <b>Largest Loss</b> and <b>Avg Severity</b> drive excess/umbrella pricing. Watch <b>open</b> claims — they're still developing.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total jobs" value={String(jobs.length)} />
        <StatCard label="Ready" value={String(byStatus.ready ?? 0)} />
        <StatCard label="In progress" value={String((byStatus.extracting ?? 0) + (byStatus.reconciling ?? 0))} />
        <StatCard label="Errors" value={String(byStatus.error ?? 0)} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <QuickAction to="/templates" icon={FileStack} title="Templates" desc="Manage extraction schemas per line of business." />
      </div>

      <Card>
        <CardHeader className="gap-3">
          <CardTitle>Loss run jobs</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-56">
              <Search className="h-4 w-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Search carrier, job, line of business, template…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            <div className="flex gap-1">
              {(["all", "ready", "in progress", "error"] as const).map((f) => (
                <Button key={f} size="sm" variant={statusFilter === f ? "default" : "outline"} onClick={() => setStatusFilter(f)}>
                  {f === "all" ? "All" : f === "in progress" ? "In progress" : f === "ready" ? "Ready" : "Errors"}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Job</TableHead>
                <TableHead>Carrier</TableHead>
                <TableHead>LoB</TableHead>
                <TableHead>Template</TableHead>
                <TableHead>Files</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((j) => (
                <TableRow key={j.id}>
                  <TableCell><Link to="/jobs/$id" params={{ id: j.id }} className="font-medium hover:underline">{j.name}</Link></TableCell>
                  <TableCell>{j.clients?.name ?? "—"}</TableCell>
                  <TableCell>{j.lines_of_business?.name ?? "—"}</TableCell>
                  <TableCell>{j.templates?.name ?? "—"}</TableCell>
                  <TableCell>{(j.source_files as any[])?.length ?? 0}</TableCell>
                  <TableCell><Badge variant={j.status === "ready" ? "default" : j.status === "error" ? "destructive" : "secondary"}>{j.status}</Badge></TableCell>
                  <TableCell className="text-xs">{new Date(j.created_at).toLocaleString()}</TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-6">
                    {jobs.length === 0
                      ? isAdmin ? "No jobs yet. Click Load demo data to explore, or start one from New extraction." : "No jobs yet. Start one from New extraction."
                      : "No jobs match your search."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">{label}</div><div className="text-2xl font-semibold">{value}</div></CardContent></Card>
  );
}
function QuickAction({ to, icon: Icon, title, desc }: any) {
  return (
    <Link to={to} className="border rounded-md p-4 bg-background hover:bg-accent flex gap-3">
      <Icon className="h-5 w-5 mt-0.5" />
      <div>
        <div className="font-medium text-sm">{title}</div>
        <div className="text-xs text-muted-foreground">{desc}</div>
      </div>
    </Link>
  );
}
