import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

import { ensureAdmin } from "./admin-auth";
import { canUseModel } from "./model-access";

export const listUsersWithRoles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profiles, error } = await supabaseAdmin
      .from("profiles")
      .select("user_id, email, display_name, created_at, lob_id")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const { data: roles } = await supabaseAdmin.from("user_roles").select("user_id, role");
    const byUser = new Map<string, string[]>();
    (roles ?? []).forEach((r: any) => {
      const arr = byUser.get(r.user_id) ?? [];
      arr.push(r.role);
      byUser.set(r.user_id, arr);
    });
    const { data: lobs } = await supabaseAdmin.from("lines_of_business").select("id, name, active");
    const { data: tpls } = await supabaseAdmin.from("templates").select("id, name, lob_id, is_baseline, lines_of_business(active)");
    const { data: access } = await supabaseAdmin.from("user_template_access").select("user_id, template_id, enabled");
    const lobName = new Map((lobs ?? []).map((l: any) => [l.id, l.name]));
    return (profiles ?? []).map((p: any) => {
      const r = byUser.get(p.user_id) ?? [];
      const overrides = new Map((access ?? []).filter((a: any) => a.user_id === p.user_id).map((a: any) => [a.template_id, a.enabled]));
      const model_access = (tpls ?? []).filter((t: any) => t.is_baseline || t.lines_of_business?.active).map((t: any) => ({
        id: t.id, name: t.name, lob_id: t.lob_id, is_baseline: t.is_baseline,
        enabled: canUseModel(t, r.includes("admin"), p.lob_id, overrides.get(t.id) as boolean | undefined),
        eligible: r.includes("admin") || t.is_baseline || t.lob_id === p.lob_id,
      }));
      const models = r.includes("admin") ? ["All AI models"] : model_access.filter((t) => t.enabled).map((t) => t.name);
      return { ...p, roles: r, lob_name: p.lob_id ? lobName.get(p.lob_id) ?? null : null, models, model_access };
    });
  });

export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({ user_id: z.string().uuid(), role: z.enum(["admin", "member"]), grant: z.boolean() })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.grant) {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: data.user_id, role: data.role }, { onConflict: "user_id,role" });
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", data.user_id)
        .eq("role", data.role);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const addTeamMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        email: z.string().email(),
        password: z.string().min(8),
        display_name: z.string().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: data.display_name ? { display_name: data.display_name } : {},
    });
    if (error) {
      const msg = /already/i.test(error.message)
        ? "That user already exists"
        : error.message;
      throw new Error(msg);
    }
    const uid = created.user?.id;
    if (!uid) throw new Error("Account could not be created");
    await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: uid, role: "member" }, { onConflict: "user_id,role" });
    return { ok: true, user_id: uid };
  });


export const setUserLob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ user_id: z.string().uuid(), lob_id: z.string().uuid().nullable() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("profiles").update({ lob_id: data.lob_id }).eq("user_id", data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setUserModelAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ user_id: z.string().uuid(), template_id: z.string().uuid(), enabled: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: model, error: me } = await supabaseAdmin.from("templates").select("is_baseline,lob_id").eq("id", data.template_id).single();
    const { data: profile, error: pe } = await supabaseAdmin.from("profiles").select("lob_id").eq("user_id", data.user_id).single();
    if (me || pe || !model || !profile) throw new Error("User or AI model not found");
    if (data.enabled && !model.is_baseline && model.lob_id !== profile.lob_id) throw new Error("Assign the matching line of business before enabling this AI model");
    const { error } = await supabaseAdmin.from("user_template_access").upsert(data, { onConflict: "user_id,template_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
