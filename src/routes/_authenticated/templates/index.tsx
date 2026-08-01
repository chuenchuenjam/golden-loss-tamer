import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listTemplates, listLobs, createTemplate, deleteTemplate, setTemplateLabel, copyTemplate } from "@/lib/templates.functions";
import { analyzeDocumentPages, inferFieldsFromPage } from "@/lib/template-infer.functions";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Trash2, Pencil, Plus, Upload as UploadIcon, Copy } from "lucide-react";
import { DocumentPreview } from "@/components/DocumentPreview";

import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/templates/")({
  head: () => ({
    meta: [
      { title: "Agents — Loss Run Extractor" },
      { name: "description", content: "Manage extraction agents for each line of business." },
      { property: "og:title", content: "Agents — Loss Run Extractor" },
      { property: "og:description", content: "Manage extraction agents for each line of business." },
    ],
  }),
  component: TemplatesPage,
});

type DraftField = {
  key: string;
  label: string;
  value: string;
  required: boolean;
  hint: string;
};

const STEPS = ["Upload document", "Choose page", "Review fields"];

function TemplatesPage() {
  const navigate = useNavigate();
  const list = useServerFn(listTemplates);
  const lobs = useServerFn(listLobs);
  const create = useServerFn(createTemplate);
  const del = useServerFn(deleteTemplate);
  const copy = useServerFn(copyTemplate);
  const analyzePages = useServerFn(analyzeDocumentPages);
  const inferPage = useServerFn(inferFieldsFromPage);
  const setLabel = useServerFn(setTemplateLabel);

  const qc = useQueryClient();
  const templates = useQuery({ queryKey: ["templates"], queryFn: () => list() });
  const lobList = useQuery({ queryKey: ["lobs"], queryFn: () => lobs() });

  const [name, setName] = useState("");
  const [lobId, setLobId] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [draft, setDraft] = useState<DraftField[] | null>(null);
  const [sourcePath, setSourcePath] = useState<string>("");
  const [pages, setPages] = useState<string[]>([]);
  const [page, setPage] = useState<string>("");
  const [reason, setReason] = useState<string>("");
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [busy, setBusy] = useState(false);

  const dm = useMutation({ mutationFn: (id: string) => del({ data: { id } }), onSuccess: () => qc.invalidateQueries({ queryKey: ["templates"] }) });
  const cm = useMutation({
    mutationFn: (id: string) => copy({ data: { id } }),
    onSuccess: (row: any) => {
      qc.invalidateQueries({ queryKey: ["templates"] });
      toast.success("Copied as a custom agent");
      navigate({ to: "/templates/$id", params: { id: row.id } });
    },
    onError: (e: any) => toast.error(e.message),
  });
  const lm = useMutation({
    mutationFn: (p: { id: string; label: string }) => setLabel({ data: p as { id: string; label: "System" | "Custom" | "Carrier" } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["templates"] }); toast.success("Label updated"); },
    onError: (e: any) => toast.error(e.message),
  });

  async function submitStep1(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !lobId || !file) {
      toast.error("Agent name, line of business and a sample document are required");
      return;
    }
    setBusy(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user!.id;
      const path = `${uid}/${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from("template-uploads").upload(path, file, { upsert: false });
      if (error) throw new Error(error.message);
      const res: any = await analyzePages({ data: { path, name: file.name, type: file.type } });
      setSourcePath(path);
      setPages(res.pages);
      setPage(res.recommendedPage);
      setReason(res.reason);
      setStep(2);
    } catch (err: any) {
      toast.error(err.message ?? "Could not analyse that document");
    } finally {
      setBusy(false);
    }
  }

  async function submitStep2() {
    if (!file || !page) return;
    setBusy(true);
    try {
      const res: any = await inferPage({ data: { path: sourcePath, name: file.name, type: file.type, page } });
      setDraft(res.fields as DraftField[]);
      setStep(3);
      toast.success(`Detected ${res.fields.length} fields — review the values`);
    } catch (err: any) {
      toast.error(err.message ?? "Could not extract that page");
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
          fields: draft.map(({ key, label, required, hint, value }) => ({ key, label, required, hint, value })),
          source_file_path: sourcePath,
          label: "Custom",
        },
      });
      qc.invalidateQueries({ queryKey: ["templates"] });
      toast.success("Agent saved");
      reset();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setName(""); setLobId(""); setFile(null); setDraft(null); setSourcePath("");
    setPages([]); setPage(""); setReason(""); setStep(1);
  }

  return (
    <div className="p-6 max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Agents</h1>
        <p className="text-sm text-muted-foreground">Train an agent on a real loss run in three steps: upload, pick the page, review the extracted values.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Create agent</CardTitle>
          <div className="flex flex-wrap gap-2 pt-2">
            {STEPS.map((s, i) => (
              <div key={s} className={`flex items-center gap-2 rounded-full border px-3 py-1 text-xs ${step === i + 1 ? "border-primary bg-primary/10 text-foreground" : "text-muted-foreground"}`}>
                <span className="font-semibold">{i + 1}</span> {s}
              </div>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          {step === 1 && (
            <form className="space-y-3" onSubmit={submitStep1}>
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <Label>Agent name</Label>
                  <Input placeholder="e.g. Travelers WC loss run agent" value={name} onChange={(e) => setName(e.target.value)} />
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
              <Button className="w-full" disabled={busy}>{busy ? "Analysing document…" : "Continue"}</Button>
            </form>
          )}

          {step === 2 && (
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="space-y-4 lg:col-span-1">
                <div className="rounded-md border bg-muted/40 p-3 text-sm">
                  <div className="font-medium">AI suggests: {page}</div>
                  <div className="text-muted-foreground">{reason}</div>
                </div>
                <p className="text-sm text-muted-foreground">Does this page cover every field you want to extract? Pick another one to see it in the preview.</p>
                <div className="grid gap-2">
                  {pages.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPage(p)}
                      className={`rounded-md border px-3 py-2 text-sm text-left ${p === page ? "border-primary bg-primary/10" : "hover:bg-accent"}`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button onClick={submitStep2} disabled={busy || !page}>{busy ? "Extracting…" : "Extract this page"}</Button>
                  <Button variant="outline" onClick={() => setStep(1)} disabled={busy}>Back</Button>
                </div>
              </div>
              <DocumentPreview file={file} page={page} className="lg:col-span-2" />
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">Extracted from: <span className="font-medium">{page}</span> of {file?.name}</div>
              <p className="text-sm text-muted-foreground">Check each detected field against your document. Override any value the AI got wrong, then confirm to save this as an agent.</p>

              <div className="grid grid-cols-12 gap-2 px-2 text-xs font-medium text-muted-foreground">
                <div className="col-span-3">Keyword (key)</div>
                <div className="col-span-3">Label</div>
                <div className="col-span-4">Extracted value</div>
                <div className="col-span-2 text-center">Required</div>
              </div>
              <div className="space-y-2">
                {draft?.map((f, i) => (
                  <div key={i} className="border rounded-md p-3 space-y-2">
                    <div className="grid grid-cols-12 gap-2 items-center">
                      <Input className="col-span-3" placeholder="key" value={f.key} onChange={(e) => patch(i, { key: e.target.value.replace(/\s+/g, "_").toLowerCase() })} />
                      <Input className="col-span-3" placeholder="label" value={f.label} onChange={(e) => patch(i, { label: e.target.value })} />
                      <Input className="col-span-4" placeholder="value" value={f.value} onChange={(e) => patch(i, { value: e.target.value })} />
                      <div className="col-span-2 flex items-center justify-center gap-2">
                        <Checkbox checked={f.required} onCheckedChange={(v) => patch(i, { required: !!v })} />
                        <Button type="button" variant="ghost" size="icon" onClick={() => setDraft((d) => d!.filter((_, idx) => idx !== i))}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </div>
                    <Input placeholder="hint for the extraction model" value={f.hint} onChange={(e) => patch(i, { hint: e.target.value })} />
                  </div>
                ))}
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => setDraft((d) => [...(d ?? []), { key: "", label: "", value: "", required: false, hint: "" }])}>
                <Plus className="h-4 w-4 mr-1" /> Add field
              </Button>
              <div className="flex gap-2">
                <Button onClick={confirm} disabled={busy}>{busy ? "Saving…" : "Confirm & save agent"}</Button>
                <Button variant="outline" onClick={() => setStep(2)} disabled={busy}>Back</Button>
                <Button variant="ghost" onClick={reset} disabled={busy}>Cancel</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>All agents</CardTitle></CardHeader>
        <CardContent className="space-y-1">
          {(templates.data as any[] | undefined)?.map((t) => (
            <div key={t.id} className="flex items-center justify-between border rounded-md px-3 py-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm font-medium">
                  {t.name}
                  <Badge variant={t.label === "System" ? "secondary" : "outline"}>{t.label ?? "Custom"}</Badge>
                </div>
                <div className="text-xs text-muted-foreground">
                  {t.lines_of_business?.name} · {(t.fields as any[])?.length ?? 0} fields
                </div>
              </div>
              <div className="flex items-center gap-1">
                {t.is_system ? (
                  <Button variant="outline" size="sm" onClick={() => cm.mutate(t.id)} disabled={cm.isPending}>
                    <Copy className="h-4 w-4 mr-1" /> Copy &amp; edit
                  </Button>
                ) : (
                  <>
                    <Select value={t.label ?? "Custom"} onValueChange={(v) => lm.mutate({ id: t.id, label: v })}>
                      <SelectTrigger className="h-8 w-[120px] text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["System", "Custom", "Carrier"].map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Button variant="ghost" size="icon" onClick={() => cm.mutate(t.id)}><Copy className="h-4 w-4" /></Button>
                    <Link to="/templates/$id" params={{ id: t.id }}><Button variant="ghost" size="icon"><Pencil className="h-4 w-4" /></Button></Link>
                    <Button variant="ghost" size="icon" onClick={() => dm.mutate(t.id)}><Trash2 className="h-4 w-4" /></Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

    </div>
  );
}
