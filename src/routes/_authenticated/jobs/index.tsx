import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listJobs } from "@/lib/jobs.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/jobs/")({
  head: () => ({
    meta: [
      { title: "Jobs history — Loss Run Extractor" },
      { name: "description", content: "Historical record of all loss run extractions." },
      { property: "og:title", content: "Jobs history — Loss Run Extractor" },
      { property: "og:description", content: "Historical record of all loss run extractions." },
    ],
  }),
  component: JobsPage,
});

function JobsPage() {
  const fn = useServerFn(listJobs);
  const { data = [] } = useQuery({ queryKey: ["jobs"], queryFn: () => fn() });

  return (
    <div className="p-6 max-w-6xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Jobs history</h1>
        <p className="text-sm text-muted-foreground">Every extraction — files uploaded, template used, timestamps, client.</p>
      </div>
      <Card>
        <CardHeader><CardTitle>All jobs</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Job</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>LoB</TableHead>
                <TableHead>Template</TableHead>
                <TableHead>Files</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data as any[]).map((j) => (
                <TableRow key={j.id} className="cursor-pointer">
                  <TableCell><Link to="/jobs/$id" params={{ id: j.id }} className="hover:underline">{j.name}</Link></TableCell>
                  <TableCell>{j.clients?.name ?? "—"}</TableCell>
                  <TableCell>{j.lines_of_business?.name ?? "—"}</TableCell>
                  <TableCell>{j.templates?.name ?? "—"}</TableCell>
                  <TableCell>{(j.source_files as any[])?.length ?? 0}</TableCell>
                  <TableCell><Badge variant={j.status === "ready" ? "default" : j.status === "error" ? "destructive" : "secondary"}>{j.status}</Badge></TableCell>
                  <TableCell className="text-xs">{new Date(j.created_at).toLocaleString()}</TableCell>
                </TableRow>
              ))}
              {(data as any[]).length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground">No jobs yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
