import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { canSeeUwSummary } from "./model-access";

const SourceFile = z.object({
  name: z.string(),
  path: z.string(),
  size: z.number(),
  type: z.string(),
});

export const listJobs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("extraction_jobs")
      .select("*, clients(name), templates(name), lines_of_business(name, slug)")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data;
  });

export const getJob = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: job, error } = await context.supabase
      .from("extraction_jobs")
      .select("*, clients(name), templates(id, name, fields), lines_of_business(name, slug)")
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);
    const { data: rows } = await context.supabase
      .from("extraction_rows")
      .select("*")
      .eq("job_id", data.id)
      .order("row_index");
    const { data: issues } = await context.supabase
      .from("data_quality_issues")
      .select("*")
      .eq("job_id", data.id);
    const { data: admin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    const { data: models } = await context.supabase.from("model_catalogue").select("id,is_baseline,lob_id");
    const { data: profile } = await context.supabase.from("profiles").select("lob_id").eq("user_id", context.userId).single();
    const { data: access } = await context.supabase.from("user_template_access").select("template_id,enabled").eq("user_id", context.userId);
    const overrides = new Map((access ?? []).map((a: any) => [a.template_id, a.enabled as boolean]));
    const uw_access = canSeeUwSummary((models ?? []) as any, !!admin, profile?.lob_id ?? null, overrides, (job as any).lob_id ?? null);
    return { job, rows: rows ?? [], issues: issues ?? [], uw_access };
  });

export const createJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        name: z.string().min(1),
        client_id: z.string().uuid().nullable().optional(),
        template_id: z.string().uuid(),
        lob_id: z.string().uuid(),
        source_files: z.array(SourceFile),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("extraction_jobs")
      .insert({
        user_id: context.userId,
        name: data.name,
        client_id: data.client_id ?? null,
        template_id: data.template_id,
        lob_id: data.lob_id,
        source_files: data.source_files,
        status: "pending",
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updateRow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        data: z.record(z.string(), z.any()).optional(),
        included_in_export: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const patch: Record<string, unknown> = {};
    if (data.data !== undefined) patch.data = data.data;
    if (data.included_in_export !== undefined) patch.included_in_export = data.included_in_export;
    const { error } = await (context.supabase.from("extraction_rows") as any).update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("extraction_jobs").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
