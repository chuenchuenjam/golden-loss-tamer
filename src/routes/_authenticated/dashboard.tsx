import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listJobs } from "@/lib/jobs.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Upload, ClipboardList, FileStack, Building2 } from "lucide-react";

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

function Dashboard() {
  const fetch = useServerFn(listJobs);
  const { data: jobs = [] } = useQuery({ queryKey: ["jobs"], queryFn: () => fetch() });

  const byStatus = (jobs as any[]).reduce<Record<string, number>>((acc, j) => {
    acc[j.status] = (acc[j.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Extract, reconcile, and export loss runs.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total jobs" value={jobs.length} />
        <StatCard label="Ready" value={byStatus.ready ?? 0} />
        <StatCard label="In progress" value={(byStatus.extracting ?? 0) + (byStatus.reconciling ?? 0)} />
        <StatCard label="Errors" value={byStatus.error ?? 0} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <QuickAction to="/upload" icon={Upload} title="New extraction" desc="Upload loss run documents and extract." />
        <QuickAction to="/jobs" icon={ClipboardList} title="Jobs history" desc="Review past extractions." />
        <QuickAction to="/templates" icon={FileStack} title="Templates" desc="Manage extraction schemas per line of business." />
        <QuickAction to="/clients" icon={Building2} title="Clients" desc="Organize extractions by client." />
      </div>

      <Card>
        <CardHeader><CardTitle>Recent jobs</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2">
            {(jobs as any[]).slice(0, 8).map((j) => (
              <Link
                key={j.id}
                to="/jobs/$id"
                params={{ id: j.id }}
                className="flex items-center justify-between border rounded-md px-3 py-2 hover:bg-accent"
              >
                <div>
                  <div className="font-medium text-sm">{j.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {j.clients?.name ?? "No client"} · {j.lines_of_business?.name} · {new Date(j.created_at).toLocaleString()}
                  </div>
                </div>
                <Badge variant={j.status === "ready" ? "default" : j.status === "error" ? "destructive" : "secondary"}>{j.status}</Badge>
              </Link>
            ))}
            {jobs.length === 0 && <p className="text-sm text-muted-foreground">No jobs yet. Start one from “New extraction”.</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
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
