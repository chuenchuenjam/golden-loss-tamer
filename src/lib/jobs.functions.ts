import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

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
    return { job, rows: rows ?? [], issues: issues ?? [] };
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
