import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/bootstrap-users")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        void request;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const targets = [
          { email: "winnie.chuen1@axaxl.com", password: "62819668", display_name: "Winnie Chuen" },
          { email: "Admin@ida.com", password: "Demo2026IDA", display_name: "Admin" },
        ];
        const results: any[] = [];
        for (const u of targets) {
          const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
          const existing = list?.users.find((x) => x.email?.toLowerCase() === u.email.toLowerCase());
          if (existing) {
            const { error } = await supabaseAdmin.auth.admin.updateUserById(existing.id, {
              password: u.password,
              email_confirm: true,
              user_metadata: { display_name: u.display_name },
            });
            results.push({ email: u.email, updated: !error, error: error?.message });
          } else {
            const { data, error } = await supabaseAdmin.auth.admin.createUser({
              email: u.email,
              password: u.password,
              email_confirm: true,
              user_metadata: { display_name: u.display_name },
            });
            results.push({ email: u.email, created: data?.user?.id, error: error?.message });
          }
        }
        return new Response(JSON.stringify(results), {
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});
