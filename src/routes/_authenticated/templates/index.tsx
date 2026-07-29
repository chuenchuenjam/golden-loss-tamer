import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listTemplates, listLobs, createTemplate, deleteTemplate, markGolden, setTemplateLabel } from "@/lib/templates.functions";
import { inferTemplateFields } from "@/lib/template-infer.functions";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Trash2, Star, Pencil, Plus, Upload as UploadIcon } from "lucide-react";
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

type DraftField = {
  key: string;
  label: string;
  type: "string" | "number" | "date" | "boolean";
  required: boolean;
  hint: string;
  samples: string[];
};

function TemplatesPage() {
  const list = useServerFn(listTemplates);
  const lobs = useServerFn(listLobs);
  const create = useServerFn(createTemplate);
  const del = useServerFn(deleteTemplate);
  const golden = useServerFn(markGolden);
  const infer = useServerFn(inferTemplateFields);
  const setLabel = useServerFn(setTemplateLabel);

  const qc = useQueryClient();
  const templates = useQuery({ queryKey: ["templates"], queryFn: () => list() });
  const lobList = useQuery({ queryKey: ["lobs"], queryFn: () => lobs() });

  const [name, setName] = useState("");
  const [lobId, setLobId] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [draft, setDraft] = useState<DraftField[] | null>(null);
  const [sourcePath, setSourcePath] = useState<string>("");
  const [step, setStep] = useState<"upload" | "review">("upload");
  const [busy, setBusy] = useState(false);

  const dm = useMutation({ mutationFn: (id: string) => del({ data: { id } }), onSuccess: () => qc.invalidateQueries({ queryKey: ["templates"] }) });
  const gm = useMutation({ mutationFn: (id: string) => golden({ data: { id } }), onSuccess: () => { qc.invalidateQueries({ queryKey: ["templates"] }); toast.success("Marked as golden source"); } });
  const lm = useMutation({
    mutationFn: (p: { id: string; label: string }) => setLabel({ data: p as { id: string; label: "System" | "Custom" | "Carrier" } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["templates"] }); toast.success("Label updated"); },
    onError: (e: any) => toast.error(e.message),
  });


  async function analyze(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !lobId || !file) {
      toast.error("Template name, line of business and a sample document are required");
      return;
    }
    setBusy(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user!.id;
      const path = `${uid}/${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from("template-uploads").upload(path, file, { upsert: false });
      if (error) throw new Error(error.message);
      const res: any = await infer({ data: { path, name: file.name, type: file.type } });
      setSourcePath(path);
      setDraft(res.fields as DraftField[]);
      setStep("review");
      toast.success(`Detected ${res.fields.length} fields — review before confirming`);
    } catch (err: any) {
      toast.error(err.message ?? "Could not analyse that document");
    } finally {
      setBusy(false);
    }
  }

  function patch(i: number, p: Partial<DraftField>) {
    setDraft((d) => (d ? d.map((f, idx) => (idx === i ? { ...f, ...p } : f)) : d));
  }

  async function confirm() {
    if (!draft || draft.length === 0) return;
    setBusy(true);
    try {
      await create({
        data: {
          name: name.trim(),
          lob_id: lobId,
          fields: draft.map(({ key, label, type, required, hint }) => ({ key, label, type, required, hint })),
          source_file_path: sourcePath,
          set_golden: true,
        },
      });
      qc.invalidateQueries({ queryKey: ["templates"] });
      toast.success("Template confirmed as the golden source of truth");
      reset();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setName(""); setLobId(""); setFile(null); setDraft(null); setSourcePath(""); setStep("upload");
  }

  return (
    <div className="p-6 max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Templates</h1>
        <p className="text-sm text-muted-foreground">Build a template from a real loss run, review the detected fields, then confirm it as the golden source.</p>
      </div>
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="pt-4 text-sm text-muted-foreground">
          A <b>golden template</b> is your firm's canonical schema for a line of business. Every extraction against it produces the same fields, so submissions become directly comparable — the foundation for triangles, frequency/severity, and pricing benchmarks.
        </CardContent>
      </Card>

      {step === "upload" ? (
        <Card>
          <CardHeader><CardTitle>Create template from a document</CardTitle></CardHeader>
          <CardContent>
            <form className="space-y-3" onSubmit={analyze}>
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <Label>Template name</Label>
                  <Input placeholder="e.g. Travelers WC loss run" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div>
                  <Label>Line of business</Label>
                  <Select value={lobId} onValueChange={setLobId}>
                    <SelectTrigger><SelectValue placeholder="Line of business" /></SelectTrigger>
                    <SelectContent>
                      {(lobList.data as any[] | undefined)?.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Sample loss run</Label>
                <label className="mt-1 flex flex-col items-center justify-center border-2 border-dashed rounded-md p-6 cursor-pointer hover:bg-accent">
                  <UploadIcon className="h-6 w-6 mb-2" />
                  <span className="text-sm">{file ? file.name : "Click to upload PDF / XLSX / CSV"}</span>
                  <input type="file" className="hidden" accept=".pdf,.xlsx,.xls,.csv,application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                </label>
              </div>
              <Button className="w-full" disabled={busy}>{busy ? "Analysing document…" : "Analyse & propose fields"}</Button>
            </form>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader><CardTitle>Review detected fields — {name}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">Check each field against the sample values pulled from your document. Edit names, types and hints, remove anything you don't need, then confirm.</p>
            <div className="space-y-2">
              {draft?.map((f, i) => (
                <div key={i} className="border rounded-md p-3 space-y-2">
                  <div className="grid gap-2 sm:grid-cols-4">
                    <Input placeholder="key" value={f.key} onChange={(e) => patch(i, { key: e.target.value })} />
                    <Input placeholder="label" value={f.label} onChange={(e) => patch(i, { label: e.target.value })} />
                    <Select value={f.type} onValueChange={(v) => patch(i, { type: v as DraftField["type"] })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["string", "number", "date", "boolean"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <div className="flex items-center justify-between gap-2">
                      <label className="flex items-center gap-2 text-sm">
                        <Checkbox checked={f.required} onCheckedChange={(v) => patch(i, { required: !!v })} /> Required
                      </label>
                      <Button type="button" variant="ghost" size="icon" onClick={() => setDraft((d) => d!.filter((_, idx) => idx !== i))}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </div>
                  <Input placeholder="hint" value={f.hint} onChange={(e) => patch(i, { hint: e.target.value })} />
                  {f.samples?.length > 0 && (
                    <div className="text-xs text-muted-foreground">Samples: {f.samples.slice(0, 3).join(" · ")}</div>
                  )}
                </div>
              ))}
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => setDraft((d) => [...(d ?? []), { key: "", label: "", type: "string", required: false, hint: "", samples: [] }])}>
              <Plus className="h-4 w-4 mr-1" /> Add field
            </Button>
            <p className="text-xs text-muted-foreground">Confirming saves this template and sets it as the golden source of truth for the selected line of business, replacing any previous golden template there.</p>
            <div className="flex gap-2">
              <Button onClick={confirm} disabled={busy}>{busy ? "Saving…" : "Confirm as golden source"}</Button>
              <Button variant="outline" onClick={reset} disabled={busy}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>All templates</CardTitle></CardHeader>
        <CardContent className="space-y-1">
          {(templates.data as any[] | undefined)?.map((t) => (
            <div key={t.id} className="flex items-center justify-between border rounded-md px-3 py-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm font-medium">
                  {t.name}
                  {t.is_golden && <Badge className="bg-amber-500 hover:bg-amber-500">Golden</Badge>}
                  <Badge variant={t.label === "System" ? "secondary" : "outline"}>{t.label ?? "Custom"}</Badge>
                </div>
                <div className="text-xs text-muted-foreground">
                  {t.lines_of_business?.name} · {(t.fields as any[])?.length ?? 0} fields
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Select value={t.label ?? "Custom"} onValueChange={(v) => lm.mutate({ id: t.id, label: v })}>
                  <SelectTrigger className="h-8 w-[120px] text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["System", "Custom", "Carrier"].map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
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
