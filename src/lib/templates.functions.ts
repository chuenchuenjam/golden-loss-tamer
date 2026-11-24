import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { ensureAdmin } from "./admin-auth";
import { canUseModel, modelAvailability } from "./model-access";

const FieldSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  required: z.boolean().default(false),
  hint: z.string().default(""),
  value: z.string().default(""),
});

export type TemplateField = z.infer<typeof FieldSchema>;

export const listLobs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("lines_of_business")
      .select("*")
      .eq("active", true)
      .order("name");
    if (error) throw new Error(error.message);
    return data;
  });

export const listTemplates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: role, error: re } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (re) throw new Error(re.message);
    // The catalogue exposes only names/labels; configuration stays admin-only.
    const { data, error } = role
      ? await context.supabase.from("templates").select("*, lines_of_business(name, slug, active)").order("created_at", { ascending: false })
      : await context.supabase.from("model_catalogue").select("*");
    if (error) throw new Error(error.message);
    const { data: profile } = await context.supabase.from("profiles").select("lob_id").eq("user_id", context.userId).single();
    const { data: access, error: ae } = await context.supabase.from("user_template_access").select("template_id,enabled").eq("user_id", context.userId);
    if (ae) throw new Error(ae.message);
    const overrides = new Map((access ?? []).map((a) => [a.template_id, a.enabled]));
    const catalogue = (data ?? []).map((row: any) => row.lines_of_business ? row : {
      ...row, lines_of_business: { name: row.lob_name, slug: row.lob_slug, active: row.lob_active },
    });
    return catalogue.filter((t) => t.is_baseline || t.lines_of_business?.active).map((t) => {
      const available = canUseModel(t, !!role, profile?.lob_id ?? null, overrides.get(t.id));
      const metadata = { id: t.id, name: t.name, lob_id: t.lob_id, is_baseline: t.is_baseline, is_system: t.is_system,
        label: t.label, source_kind: t.source_kind, lines_of_business: t.lines_of_business, available,
        availability_label: modelAvailability(t, available) };
      return role ? { ...t, ...metadata } : metadata;
    });
  });

export const getTemplate = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.supabase, context.userId);
    const { data: row, error } = await context.supabase
      .from("templates")
      .select("*, lines_of_business(name, slug)")
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const createTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        name: z.string().min(1),
        lob_id: z.string().uuid(),
        fields: z.array(FieldSchema).default([]),
        cloneFrom: z.string().uuid().optional(),
        source_file_path: z.string().optional(),
        label: z.enum(["System", "Custom", "Carrier"]).optional(),
        source_kind: z.enum(["Standard", "Golden Source", "Edge Case"]).default("Standard"),
        golden_template_id: z.string().uuid().nullable().default(null),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.supabase, context.userId);
    let fields = data.fields;
    if (data.cloneFrom) {
      const { data: src } = await context.supabase
        .from("templates")
        .select("fields")
        .eq("id", data.cloneFrom)
        .single();
      if (src) fields = src.fields as TemplateField[];
    }
    const { data: row, error } = await context.supabase
      .from("templates")
      .insert({
        name: data.name,
        lob_id: data.lob_id,
        fields,
        owner_user_id: context.userId,
        is_system: data.label === "System",
        source_kind: data.source_kind,
        golden_template_id: data.golden_template_id,
        label: data.label ?? "Custom",
        source_file_path: data.source_file_path ?? null,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const copyTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.supabase, context.userId);
    const { data: src, error: e1 } = await context.supabase
      .from("templates")
      .select("name, lob_id, fields, source_file_path, source_kind, golden_template_id")
      .eq("id", data.id)
      .single();
    if (e1 || !src) throw new Error(e1?.message ?? "Template not found");
    const { data: row, error } = await context.supabase
      .from("templates")
      .insert({
        name: `${src.name} (copy)`,
        lob_id: src.lob_id,
        fields: src.fields,
        source_file_path: src.source_file_path,
        source_kind: src.source_kind,
        golden_template_id: src.golden_template_id,
        owner_user_id: context.userId,
        is_system: false,
        label: "Custom",
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const setTemplateLabel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({ id: z.string().uuid(), label: z.enum(["System", "Custom", "Carrier"]) })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.supabase, context.userId);
    const { data: existing, error: ee } = await context.supabase.from("templates").select("is_system,label").eq("id", data.id).single();
    if (ee || !existing) throw new Error("AI model not found");
    if (existing.is_system || existing.label === "System") throw new Error("System AI models are read-only. Copy as custom first.");
    const { error } = await context.supabase
      .from("templates")
      .update({ label: data.label, is_system: data.label === "System" })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });


export const updateTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        name: z.string().min(1).optional(),
        fields: z.array(FieldSchema).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.supabase, context.userId);
    const { data: existing, error: ee } = await context.supabase.from("templates").select("is_system,label").eq("id", data.id).single();
    if (ee || !existing) throw new Error("AI model not found");
    if (existing.is_system || existing.label === "System") throw new Error("System AI models are read-only. Copy as custom first.");
    const patch: { name?: string; fields?: TemplateField[] } = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.fields !== undefined) patch.fields = data.fields;
    const { data: row, error } = await context.supabase
      .from("templates")
      .update(patch)
      .eq("id", data.id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.supabase, context.userId);
    const { data: existing, error: ee } = await context.supabase.from("templates").select("is_system,label").eq("id", data.id).single();
    if (ee || !existing) throw new Error("AI model not found");
    if (existing.is_system || existing.label === "System") throw new Error("System AI models are read-only. Copy as custom first.");
    const { error } = await context.supabase.from("templates").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setModelSource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), source_kind: z.enum(["Standard", "Golden Source", "Edge Case"]), golden_template_id: z.string().uuid().nullable().default(null) }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("templates").update({ source_kind: data.source_kind, golden_template_id: data.source_kind === "Edge Case" ? data.golden_template_id : null }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
