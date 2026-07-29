import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

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
      .order("name");
    if (error) throw new Error(error.message);
    return data;
  });

export const listTemplates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("templates")
      .select("*, lines_of_business(name, slug)")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data;
  });

export const getTemplate = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
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
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
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
        is_system: false,
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
    const { data: src, error: e1 } = await context.supabase
      .from("templates")
      .select("name, lob_id, fields")
      .eq("id", data.id)
      .single();
    if (e1 || !src) throw new Error(e1?.message ?? "Template not found");
    const { data: row, error } = await context.supabase
      .from("templates")
      .insert({
        name: `${src.name} (copy)`,
        lob_id: src.lob_id,
        fields: src.fields,
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
    const { error } = await context.supabase
      .from("templates")
      .update({ label: data.label })
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
    const { error } = await context.supabase.from("templates").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
