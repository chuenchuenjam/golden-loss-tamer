import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getTemplate, updateTemplate } from "@/lib/templates.functions";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Trash2, Plus, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/templates/$id")({
  head: () => ({
    meta: [
      { title: "Edit template — Loss Run Extractor" },
      { name: "description", content: "Configure fields for this extraction template." },
      { property: "og:title", content: "Edit template — Loss Run Extractor" },
      { property: "og:description", content: "Configure fields for this extraction template." },
    ],
  }),
  component: EditTemplate,
});

type Field = { key: string; label: string; type: "string" | "number" | "date" | "boolean"; required: boolean; hint: string };

function EditTemplate() {
  const { id } = Route.useParams();
  const get = useServerFn(getTemplate);
  const upd = useServerFn(updateTemplate);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["template", id], queryFn: () => get({ data: { id } }) });
  const [name, setName] = useState("");
  const [fields, setFields] = useState<Field[]>([]);

  useEffect(() => {
    if (q.data) {
      setName((q.data as any).name);
      setFields(((q.data as any).fields ?? []) as Field[]);
    }
  }, [q.data]);

  const m = useMutation({
    mutationFn: () => upd({ data: { id, name, fields } }),
    onSuccess: () => { toast.success("Saved"); qc.invalidateQueries({ queryKey: ["template", id] }); qc.invalidateQueries({ queryKey: ["templates"] }); },
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
        <CardHeader><CardTitle>Template</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Fields</CardTitle>
          <Button size="sm" onClick={() => setFields((p) => [...p, { key: `field_${p.length + 1}`, label: "New field", type: "string", required: false, hint: "" }])}>
            <Plus className="h-4 w-4 mr-1" /> Add field
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground px-2">
            <div className="col-span-3">Key</div>
            <div className="col-span-3">Label</div>
            <div className="col-span-2">Type</div>
            <div className="col-span-3">Hint</div>
            <div className="col-span-1 text-center">Req</div>
          </div>
          {fields.map((f, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-center border rounded-md p-2">
              <Input className="col-span-3" value={f.key} onChange={(e) => updateField(i, { key: e.target.value.replace(/\s+/g, "_").toLowerCase() })} />
              <Input className="col-span-3" value={f.label} onChange={(e) => updateField(i, { label: e.target.value })} />
              <Select value={f.type} onValueChange={(v) => updateField(i, { type: v as Field["type"] })}>
                <SelectTrigger className="col-span-2"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="string">string</SelectItem>
                  <SelectItem value="number">number</SelectItem>
                  <SelectItem value="date">date</SelectItem>
                  <SelectItem value="boolean">boolean</SelectItem>
                </SelectContent>
              </Select>
              <Input className="col-span-3" placeholder="Hint for AI" value={f.hint} onChange={(e) => updateField(i, { hint: e.target.value })} />
              <div className="col-span-1 flex items-center justify-center gap-1">
                <Checkbox checked={f.required} onCheckedChange={(v) => updateField(i, { required: !!v })} />
                <Button variant="ghost" size="icon" onClick={() => setFields((p) => p.filter((_, idx) => idx !== i))}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
          ))}
          {fields.length === 0 && <p className="text-sm text-muted-foreground">No fields. Add one to describe what should be extracted.</p>}
        </CardContent>
      </Card>
      <div className="flex justify-end">
        <Button onClick={() => m.mutate()} disabled={m.isPending}>{m.isPending ? "Saving..." : "Save changes"}</Button>
      </div>
    </div>
  );
}
