import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getTemplate, updateTemplate, copyTemplate } from "@/lib/templates.functions";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus, ArrowLeft, Copy } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/templates/$id")({
  head: () => ({
    meta: [
      { title: "Edit agent — Loss Run Extractor" },
      { name: "description", content: "Configure the fields this extraction agent pulls from loss runs." },
      { property: "og:title", content: "Edit agent — Loss Run Extractor" },
      { property: "og:description", content: "Configure the fields this extraction agent pulls from loss runs." },
    ],
  }),
  component: EditTemplate,
});

type Field = { key: string; label: string; required: boolean; hint: string; value?: string };

function EditTemplate() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const get = useServerFn(getTemplate);
  const upd = useServerFn(updateTemplate);
  const copy = useServerFn(copyTemplate);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["template", id], queryFn: () => get({ data: { id } }) });
  const [name, setName] = useState("");
  const [fields, setFields] = useState<Field[]>([]);
  const isSystem = !!(q.data as any)?.is_system;

  useEffect(() => {
    if (q.data) {
      setName((q.data as any).name);
      setFields(((q.data as any).fields ?? []) as Field[]);
    }
  }, [q.data]);

  const m = useMutation({
    mutationFn: () => upd({ data: { id, name, fields: fields.map((f) => ({ key: f.key, label: f.label, required: !!f.required, hint: f.hint ?? "", value: f.value ?? "" })) } }),
    onSuccess: () => { toast.success("Saved"); qc.invalidateQueries({ queryKey: ["template", id] }); qc.invalidateQueries({ queryKey: ["templates"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const cm = useMutation({
    mutationFn: () => copy({ data: { id } }),
    onSuccess: (row: any) => {
      qc.invalidateQueries({ queryKey: ["templates"] });
      toast.success("Copied as a custom agent");
      navigate({ to: "/templates/$id", params: { id: row.id } });
    },
    onError: (e: any) => toast.error(e.message),
  });

  function updateField(i: number, patch: Partial<Field>) {
    setFields((prev) => prev.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));
  }

  return (
    <div className="p-6 max-w-5xl space-y-6">
      <div className="flex items-center gap-2">
        <Link to="/templates"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" /> Back</Button></Link>
      </div>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            Agent
            {isSystem && <Badge variant="secondary">System — read only</Badge>}
          </CardTitle>
          {isSystem && (
            <Button size="sm" onClick={() => cm.mutate()} disabled={cm.isPending}>
              <Copy className="h-4 w-4 mr-1" /> Copy &amp; edit as custom
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {isSystem ? (
            <p className="text-sm font-medium">{name}</p>
          ) : (
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Fields</CardTitle>
          {!isSystem && (
            <Button size="sm" onClick={() => setFields((p) => [...p, { key: `field_${p.length + 1}`, label: "New field", required: false, hint: "", value: "" }])}>
              <Plus className="h-4 w-4 mr-1" /> Add field
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground px-2">
            <div className="col-span-3">Key</div>
            <div className="col-span-3">Label</div>
            <div className="col-span-5">Hint</div>
            <div className="col-span-1 text-center">Req</div>
          </div>
          {fields.map((f, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-center border rounded-md p-2">
              {isSystem ? (
                <>
                  <div className="col-span-3 text-sm truncate">{f.key}</div>
                  <div className="col-span-3 text-sm truncate">{f.label}</div>
                  <div className="col-span-5 text-sm text-muted-foreground truncate">{f.hint}</div>
                  <div className="col-span-1 flex justify-center text-xs">{f.required ? "Yes" : "—"}</div>
                </>
              ) : (
                <>
                  <Input className="col-span-3" value={f.key} onChange={(e) => updateField(i, { key: e.target.value.replace(/\s+/g, "_").toLowerCase() })} />
                  <Input className="col-span-3" value={f.label} onChange={(e) => updateField(i, { label: e.target.value })} />
                  <Input className="col-span-5" placeholder="Hint for AI" value={f.hint} onChange={(e) => updateField(i, { hint: e.target.value })} />
                  <div className="col-span-1 flex items-center justify-center gap-1">
                    <Checkbox checked={f.required} onCheckedChange={(v) => updateField(i, { required: !!v })} />
                    <Button variant="ghost" size="icon" onClick={() => setFields((p) => p.filter((_, idx) => idx !== i))}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </>
              )}
            </div>
          ))}
          {fields.length === 0 && <p className="text-sm text-muted-foreground">No fields. Add one to describe what should be extracted.</p>}
        </CardContent>
      </Card>
      {!isSystem && (
        <div className="flex justify-end">
          <Button onClick={() => m.mutate()} disabled={m.isPending}>{m.isPending ? "Saving..." : "Save changes"}</Button>
        </div>
      )}
    </div>
  );
}
