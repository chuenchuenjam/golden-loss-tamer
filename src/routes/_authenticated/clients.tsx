import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listClients, createClient, deleteClient } from "@/lib/clients.functions";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/clients")({
  head: () => ({
    meta: [
      { title: "Clients — Loss Run Extractor" },
      { name: "description", content: "Manage clients for loss run extractions." },
      { property: "og:title", content: "Clients — Loss Run Extractor" },
      { property: "og:description", content: "Manage clients for loss run extractions." },
    ],
  }),
  component: ClientsPage,
});

function ClientsPage() {
  const list = useServerFn(listClients);
  const create = useServerFn(createClient);
  const del = useServerFn(deleteClient);
  const qc = useQueryClient();
  const { data = [] } = useQuery({ queryKey: ["clients"], queryFn: () => list() });
  const [name, setName] = useState("");
  const m = useMutation({
    mutationFn: (n: string) => create({ data: { name: n } }),
    onSuccess: () => { setName(""); qc.invalidateQueries({ queryKey: ["clients"] }); toast.success("Client added"); },
    onError: (e: any) => toast.error(e.message),
  });
  const md = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["clients"] }),
  });

  return (
    <div className="p-6 max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Clients</h1>
        <p className="text-sm text-muted-foreground">Group extractions by the insured / client account.</p>
      </div>
      <Card>
        <CardHeader><CardTitle>Add client</CardTitle></CardHeader>
        <CardContent>
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (name.trim()) m.mutate(name.trim()); }}>
            <Input placeholder="Client name" value={name} onChange={(e) => setName(e.target.value)} />
            <Button disabled={m.isPending}>Add</Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>All clients</CardTitle></CardHeader>
        <CardContent className="space-y-1">
          {(data as any[]).map((c) => (
            <div key={c.id} className="flex items-center justify-between border rounded-md px-3 py-2">
              <div className="text-sm">{c.name}</div>
              <Button variant="ghost" size="icon" onClick={() => md.mutate(c.id)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
          {(data as any[]).length === 0 && <p className="text-sm text-muted-foreground">No clients yet.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
