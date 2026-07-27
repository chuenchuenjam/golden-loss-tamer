import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation } from "@tanstack/react-query";
import { listTemplates, listLobs } from "@/lib/templates.functions";
import { listClients } from "@/lib/clients.functions";
import { createJob } from "@/lib/jobs.functions";
import { runExtraction, reconcileJob } from "@/lib/extraction.functions";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Upload as UploadIcon, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/upload")({
  head: () => ({
    meta: [
      { title: "New extraction — Loss Run Extractor" },
      { name: "description", content: "Upload loss run documents and extract fields with AI." },
      { property: "og:title", content: "New extraction — Loss Run Extractor" },
      { property: "og:description", content: "Upload loss run documents and extract fields with AI." },
    ],
  }),
  component: UploadPage,
});

function UploadPage() {
  const navigate = useNavigate();
  const templatesFn = useServerFn(listTemplates);
  const lobsFn = useServerFn(listLobs);
  const clientsFn = useServerFn(listClients);
  const createJobFn = useServerFn(createJob);
  const runFn = useServerFn(runExtraction);
  const recFn = useServerFn(reconcileJob);

  const templates = useQuery({ queryKey: ["templates"], queryFn: () => templatesFn() });
  const lobs = useQuery({ queryKey: ["lobs"], queryFn: () => lobsFn() });
  const clients = useQuery({ queryKey: ["clients"], queryFn: () => clientsFn() });

  const [name, setName] = useState("");
  const [lobId, setLobId] = useState<string>("");
  const [templateId, setTemplateId] = useState<string>("");
  const [clientId, setClientId] = useState<string>("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string>("");

  const filteredTemplates = useMemo(
    () => ((templates.data as any[]) ?? []).filter((t) => !lobId || t.lob_id === lobId),
    [templates.data, lobId],
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !templateId || !lobId || files.length === 0) {
      toast.error("Fill in all fields and add at least one file");
      return;
    }
    setBusy(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user!.id;
      const uploaded: any[] = [];
      for (const f of files) {
        setProgress(`Uploading ${f.name}...`);
        const path = `${uid}/${Date.now()}-${f.name}`;
        const { error } = await supabase.storage.from("loss-run-uploads").upload(path, f, { upsert: false });
        if (error) throw new Error(error.message);
        uploaded.push({ name: f.name, path, size: f.size, type: f.type });
      }
      setProgress("Creating job...");
      const job: any = await createJobFn({
        data: {
          name,
          client_id: clientId || null,
          template_id: templateId,
          lob_id: lobId,
          source_files: uploaded,
        },
      });
      setProgress("Extracting with AI (this may take a minute)...");
      await runFn({ data: { job_id: job.id } });
      setProgress("Reconciling...");
      await recFn({ data: { job_id: job.id } });
      toast.success("Extraction complete");
      navigate({ to: "/jobs/$id", params: { id: job.id } });
    } catch (e: any) {
      toast.error(e.message ?? "Extraction failed");
    } finally {
      setBusy(false);
      setProgress("");
    }
  }

  return (
    <div className="p-6 max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">New extraction</h1>
        <p className="text-sm text-muted-foreground">Upload PDF, XLSX or CSV loss runs; AI extracts fields per template.</p>
      </div>
      <Card>
        <CardHeader><CardTitle>Job details</CardTitle></CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={submit}>
            <div><Label>Job name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Client (optional)</Label>
                <Select value={clientId} onValueChange={setClientId}>
                  <SelectTrigger><SelectValue placeholder="No client" /></SelectTrigger>
                  <SelectContent>
                    {(clients.data as any[] | undefined)?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Line of business</Label>
                <Select value={lobId} onValueChange={(v) => { setLobId(v); setTemplateId(""); }}>
                  <SelectTrigger><SelectValue placeholder="Select LoB" /></SelectTrigger>
                  <SelectContent>
                    {(lobs.data as any[] | undefined)?.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Template</Label>
              <Select value={templateId} onValueChange={setTemplateId}>
                <SelectTrigger><SelectValue placeholder={lobId ? "Select template" : "Pick LoB first"} /></SelectTrigger>
                <SelectContent>
                  {filteredTemplates.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}{t.is_golden ? " ★" : ""}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Files</Label>
              <label className="mt-1 flex flex-col items-center justify-center border-2 border-dashed rounded-md p-6 cursor-pointer hover:bg-accent">
                <UploadIcon className="h-6 w-6 mb-2" />
                <span className="text-sm">Click to add PDF / XLSX / CSV</span>
                <input type="file" multiple className="hidden" accept=".pdf,.xlsx,.xls,.csv,application/pdf" onChange={(e) => setFiles((prev) => [...prev, ...Array.from(e.target.files ?? [])])} />
              </label>
              <div className="mt-2 space-y-1">
                {files.map((f, i) => (
                  <div key={i} className="flex items-center justify-between text-sm border rounded px-2 py-1">
                    <span className="truncate">{f.name}</span>
                    <Button type="button" variant="ghost" size="icon" onClick={() => setFiles((p) => p.filter((_, idx) => idx !== i))}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                ))}
              </div>
            </div>
            {progress && <p className="text-sm text-muted-foreground">{progress}</p>}
            <Button className="w-full" disabled={busy}>{busy ? "Working..." : "Start extraction"}</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
