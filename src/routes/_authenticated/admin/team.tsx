import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { listUsersWithRoles, setUserRole, addTeamMember, setUserLob }
import { listLobs } from "@/lib/templates.functions";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"; from "@/lib/admin.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserPlus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/team")({
  head: () => ({
    meta: [
      { title: "Team — Loss Run Extractor" },
      { name: "description", content: "Manage team members and admin roles." },
      { property: "og:title", content: "Team — Loss Run Extractor" },
      { property: "og:description", content: "Manage team members and admin roles." },
    ],
  }),
  component: TeamPage,
});

function TeamPage() {
  const listFn = useServerFn(listUsersWithRoles);
  const roleFn = useServerFn(setUserRole);
  const addFn = useServerFn(addTeamMember);
  const qc = useQueryClient();
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
      addFn({ data: { email: email.trim(), password, display_name: displayName.trim() || undefined } }),
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
    <div className="p-6 max-w-5xl space-y-4">
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
                      value={u.lob_id ?? "none"}
                      onValueChange={(v) => lm.mutate({ user_id: u.user_id, lob_id: v === "none" ? null : v })}
                    >
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Not assigned</SelectItem>
                        {(lobs as any[]).map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="max-w-64">
                    <div className="flex flex-wrap gap-1">
                      {u.models.map((n: string) => <Badge key={n} variant="outline" className="text-xs font-normal">{n}</Badge>)}
                    </div>
                  </TableCell>
                  <TableCell>{u.roles.map((r: string) => <Badge key={r} variant="secondary" className="mr-1">{r}</Badge>)}</TableCell>
                  <TableCell>
                    <Switch
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
