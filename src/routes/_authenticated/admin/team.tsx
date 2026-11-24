import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { listUsersWithRoles, setUserRole, addTeamMember, setUserLob, setUserModelAccess } from "@/lib/admin.functions";
import { listLobs } from "@/lib/templates.functions";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { UserPlus, Settings2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/team")({
  head: () => ({
    meta: [
      { title: "Team — Loss Run Extractor" },
      { name: "description", content: "Manage team members and admin roles." },
      { property: "og:title", content: "Team — Loss Run Extractor" },
      { property: "og:description", content: "Manage team members and admin roles." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TeamPage,
});

function TeamPage() {
  const listFn = useServerFn(listUsersWithRoles);
  const roleFn = useServerFn(setUserRole);
  const addFn = useServerFn(addTeamMember);
  const qc = useQueryClient();
  const accessFn = useServerFn(setUserModelAccess);
  const am = useMutation({
    mutationFn: (p: { user_id: string; template_id: string; enabled: boolean }) => accessFn({ data: p }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["team"] }); qc.invalidateQueries({ queryKey: ["templates"] }); toast.success("AI model access updated"); },
    onError: (e: Error) => toast.error(e.message),
  });
  const lobFn = useServerFn(setUserLob);
  const lobsFn = useServerFn(listLobs);
  const { data: lobs = [] } = useQuery({ queryKey: ["lobs"], queryFn: () => lobsFn() });
  const lm = useMutation({
    mutationFn: (p: { user_id: string; lob_id: string | null }) => lobFn({ data: p }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["team"] }); toast.success("Line of business updated"); },
    onError: (e: any) => toast.error(e.message),
  });
  const { data = [], error } = useQuery({ queryKey: ["team"], queryFn: () => listFn(), retry: false });

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");

  const add = useMutation({
    mutationFn: () =>
      addFn({ data: { email: email.trim(), password, ...(displayName.trim() ? { display_name: displayName.trim() } : {}) } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["team"] });
      toast.success(`${email.trim()} can now sign in with the temporary password`);
      setEmail(""); setPassword(""); setDisplayName("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const m = useMutation({
    mutationFn: (p: { user_id: string; role: "admin" | "member"; grant: boolean }) =>
      roleFn({ data: p }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["team"] }); toast.success("Updated"); },
    onError: (e: any) => toast.error(e.message),
  });


  if (error) return <div className="p-6 text-sm text-destructive">{(error as any).message}</div>;

  return (
    <div className="p-4 md:p-6 max-w-7xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Team</h1>
        <p className="text-sm text-muted-foreground">Add members and grant admin access. Admins can manage templates.</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><UserPlus className="h-4 w-4" /> Add member</CardTitle></CardHeader>
        <CardContent>
          <form
            className="grid gap-3 sm:grid-cols-4 items-end"
            onSubmit={(e) => { e.preventDefault(); add.mutate(); }}
          >
            <div>
              <Label>Email</Label>
              <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="person@company.com" />
            </div>
            <div>
              <Label>Temporary password</Label>
              <Input type="text" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="min 8 characters" />
            </div>
            <div>
              <Label>Display name (optional)</Label>
              <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            </div>
            <Button disabled={add.isPending}>{add.isPending ? "Adding…" : "Add member"}</Button>
          </form>
          <p className="text-xs text-muted-foreground mt-2">The account is created active — share the temporary password with them; they sign in on the normal sign-in page.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Members</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Email</TableHead><TableHead>Name</TableHead><TableHead>Line of business</TableHead><TableHead>AI models access</TableHead><TableHead>Roles</TableHead><TableHead className="w-32">Admin</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {(data as any[]).map((u) => (
                <TableRow key={u.user_id}>
                  <TableCell className="text-sm">{u.email}</TableCell>
                  <TableCell className="text-sm">{u.display_name ?? "—"}</TableCell>
                  <TableCell className="min-w-48">
                    <Select
                      disabled={lm.isPending}
                      value={u.lob_id ?? "none"}
                      onValueChange={(v) => lm.mutate({ user_id: u.user_id, lob_id: v === "none" ? null : v })}
                    >
                      <SelectTrigger aria-label={`Line of business for ${u.email}`} className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Not assigned</SelectItem>
                        {(lobs as any[]).map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="min-w-64 max-w-80">
                    <div className="flex flex-wrap gap-1">
                      {u.models.map((n: string) => <Badge key={n} variant="outline" className="text-xs font-normal">{n}</Badge>)}
                    </div>
                    {!u.roles.includes("admin") && (
                      <Popover>
                        <PopoverTrigger asChild><Button variant="outline" size="sm" className="mt-2" aria-label={`Model access for ${u.email}`}><Settings2 className="mr-2 h-4 w-4" /> Model access</Button></PopoverTrigger>
                        <PopoverContent className="w-80 max-w-[calc(100vw-2rem)] space-y-3">
                          <div className="text-sm font-semibold">AI model access</div>
                          {u.model_access.map((model: any) => (
                            <label key={model.id} className="flex items-start gap-2 text-sm">
                              <Checkbox aria-label={model.name} checked={model.enabled} disabled={am.isPending || !model.eligible} onCheckedChange={(v) => am.mutate({ user_id: u.user_id, template_id: model.id, enabled: v === true })} />
                              <span>{model.name}{!model.eligible && <span className="block text-xs text-muted-foreground">Different line of business</span>}{model.eligible && !model.enabled && !model.is_baseline && <span className="block text-xs text-muted-foreground">Releasing mid-Jan 2027</span>}</span>
                            </label>
                          ))}
                        </PopoverContent>
                      </Popover>
                    )}
                  </TableCell>
                  <TableCell>{u.roles.map((r: string) => <Badge key={r} variant="secondary" className="mr-1">{r}</Badge>)}</TableCell>
                  <TableCell>
                    <Switch
                      aria-label={`Admin access for ${u.email}`}
                      disabled={m.isPending}
                      checked={u.roles.includes("admin")}
                      onCheckedChange={(v) => m.mutate({ user_id: u.user_id, role: "admin", grant: v })}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
