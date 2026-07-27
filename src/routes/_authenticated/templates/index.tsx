import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listTemplates, listLobs, createTemplate, deleteTemplate, markGolden } from "@/lib/templates.functions";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Trash2, Star, Pencil } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/templates/")({
  head: () => ({
    meta: [
      { title: "Templates — Loss Run Extractor" },
      { name: "description", content: "Manage extraction templates for each line of business." },
      { property: "og:title", content: "Templates — Loss Run Extractor" },
      { property: "og:description", content: "Manage extraction templates for each line of business." },
    ],
  }),
  component: TemplatesPage,
});

function TemplatesPage() {
  const list = useServerFn(listTemplates);
  const lobs = useServerFn(listLobs);
  const create = useServerFn(createTemplate);
  const del = useServerFn(deleteTemplate);
  const golden = useServerFn(markGolden);
  const qc = useQueryClient();
  const templates = useQuery({ queryKey: ["templates"], queryFn: () => list() });
  const lobList = useQuery({ queryKey: ["lobs"], queryFn: () => lobs() });
  const [name, setName] = useState("");
  const [lobId, setLobId] = useState<string>("");
  const [cloneFrom, setCloneFrom] = useState<string | undefined>();

  const m = useMutation({
    mutationFn: () => create({ data: { name, lob_id: lobId, fields: [], cloneFrom } }),
    onSuccess: () => { setName(""); qc.invalidateQueries({ queryKey: ["templates"] }); toast.success("Template created"); },
    onError: (e: any) => toast.error(e.message),
  });
  const dm = useMutation({ mutationFn: (id: string) => del({ data: { id } }), onSuccess: () => qc.invalidateQueries({ queryKey: ["templates"] }) });
  const gm = useMutation({ mutationFn: (id: string) => golden({ data: { id } }), onSuccess: () => { qc.invalidateQueries({ queryKey: ["templates"] }); toast.success("Marked as golden source"); } });

  return (
    <div className="p-6 max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Templates</h1>
        <p className="text-sm text-muted-foreground">Define the fields extracted per line of business. Mark one as the golden source.</p>
      </div>
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="pt-4 text-sm text-muted-foreground">
          A <b>golden template</b> is your firm's canonical schema for a line of business. Every extraction against it produces the same fields, so submissions become directly comparable — the foundation for triangles, frequency/severity, and pricing benchmarks.
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Create template</CardTitle></CardHeader>
        <CardContent>
          <form className="grid gap-2 sm:grid-cols-4" onSubmit={(e) => { e.preventDefault(); if (name && lobId) m.mutate(); }}>
            <Input className="sm:col-span-2" placeholder="Template name" value={name} onChange={(e) => setName(e.target.value)} />
            <Select value={lobId} onValueChange={setLobId}>
              <SelectTrigger><SelectValue placeholder="Line of business" /></SelectTrigger>
              <SelectContent>
                {(lobList.data as any[] | undefined)?.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={cloneFrom ?? "__none"} onValueChange={(v) => setCloneFrom(v === "__none" ? undefined : v)}>
              <SelectTrigger><SelectValue placeholder="Clone from" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">Blank</SelectItem>
                {(templates.data as any[] | undefined)?.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button className="sm:col-span-4" disabled={m.isPending}>Create</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>All templates</CardTitle></CardHeader>
        <CardContent className="space-y-1">
          {(templates.data as any[] | undefined)?.map((t) => (
            <div key={t.id} className="flex items-center justify-between border rounded-md px-3 py-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm font-medium">
                  {t.name}
                  {t.is_golden && <Badge className="bg-amber-500 hover:bg-amber-500">Golden</Badge>}
                  {t.is_system && <Badge variant="secondary">System</Badge>}
                </div>
                <div className="text-xs text-muted-foreground">
                  {t.lines_of_business?.name} · {(t.fields as any[])?.length ?? 0} fields
                </div>
              </div>
              <div className="flex gap-1">
                {!t.is_golden && <Button variant="ghost" size="icon" onClick={() => gm.mutate(t.id)}><Star className="h-4 w-4" /></Button>}
                <Link to="/templates/$id" params={{ id: t.id }}><Button variant="ghost" size="icon"><Pencil className="h-4 w-4" /></Button></Link>
                {!t.is_system && <Button variant="ghost" size="icon" onClick={() => dm.mutate(t.id)}><Trash2 className="h-4 w-4" /></Button>}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
