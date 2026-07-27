import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listUsersWithRoles, listTemplateAccess, setTemplateAccess } from "@/lib/admin.functions";
import { listTemplates } from "@/lib/templates.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { useMemo } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/access")({
  head: () => ({
    meta: [
      { title: "Template access — Loss Run Extractor" },
      { name: "description", content: "Control which templates each user can access." },
      { property: "og:title", content: "Template access — Loss Run Extractor" },
      { property: "og:description", content: "Control which templates each user can access." },
    ],
  }),
  component: AccessPage,
});

function AccessPage() {
  const usersFn = useServerFn(listUsersWithRoles);
  const accessFn = useServerFn(listTemplateAccess);
  const setFn = useServerFn(setTemplateAccess);
  const templatesFn = useServerFn(listTemplates);
  const qc = useQueryClient();

  const users = useQuery({ queryKey: ["team"], queryFn: () => usersFn(), retry: false });
  const templates = useQuery({ queryKey: ["templates"], queryFn: () => templatesFn() });
  const access = useQuery({ queryKey: ["template_access"], queryFn: () => accessFn(), retry: false });

  const grantSet = useMemo(() => {
    const s = new Set<string>();
    for (const a of (access.data as any[]) ?? []) s.add(`${a.user_id}:${a.template_id}`);
    return s;
  }, [access.data]);

  const m = useMutation({
    mutationFn: (p: { user_id: string; template_id: string; grant: boolean }) => setFn({ data: p }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["template_access"] }),
    onError: (e: any) => toast.error(e.message),
  });

  const tpls = (templates.data as any[]) ?? [];
  const usrs = ((users.data as any[]) ?? []).filter((u) => !u.roles.includes("admin"));

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Template access</h1>
        <p className="text-sm text-muted-foreground">Admins always see all templates. Grant specific templates to member users. When a user has no grants, they see all non-system templates.</p>
      </div>
      <Card>
        <CardHeader><CardTitle>Grants</CardTitle></CardHeader>
        <CardContent className="overflow-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead>User</TableHead>
              {tpls.map((t) => <TableHead key={t.id} className="text-xs">{t.name}<div className="text-muted-foreground">{t.lines_of_business?.name}</div></TableHead>)}
            </TableRow></TableHeader>
            <TableBody>
              {usrs.map((u) => (
                <TableRow key={u.user_id}>
                  <TableCell className="text-sm">{u.email}</TableCell>
                  {tpls.map((t) => {
                    const key = `${u.user_id}:${t.id}`;
                    return (
                      <TableCell key={t.id}>
                        <Checkbox
                          checked={grantSet.has(key)}
                          onCheckedChange={(v) => m.mutate({ user_id: u.user_id, template_id: t.id, grant: !!v })}
                        />
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
              {usrs.length === 0 && <TableRow><TableCell colSpan={tpls.length + 1} className="text-center text-sm text-muted-foreground">No member users.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
