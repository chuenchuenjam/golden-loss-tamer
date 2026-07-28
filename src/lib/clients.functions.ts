import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const listClients = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("clients")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data;
  });

export const createClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ name: z.string().min(1).max(200) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("clients")
      .insert({ name: data.name, created_by: context.userId })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

/** Find an existing carrier by name (case-insensitive) or create it. */
export const resolveCarrier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ name: z.string().min(1).max(200) }).parse(d))
  .handler(async ({ data, context }) => {
    const name = data.name.trim();
    const { data: existing } = await context.supabase
      .from("clients")
      .select("id, name")
      .ilike("name", name)
      .limit(1);
    if (existing && existing.length > 0) return existing[0];
    const { data: row, error } = await context.supabase
      .from("clients")
      .insert({ name, created_by: context.userId })
      .select("id, name")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("clients").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
