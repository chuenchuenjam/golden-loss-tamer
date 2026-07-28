import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/bootstrap-users")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = request.headers.get("x-bootstrap-token");
        if (token !== process.env.BOOTSTRAP_TOKEN) {
          return new Response("unauthorized", { status: 401 });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const users = [
          { email: "winnie.chuen1@axaxl.com", password: "62819668", display_name: "Winnie Chuen" },
          { email: "Admin@ida.com", password: "Demo2026IDA", display_name: "Admin" },
        ];
        const results: any[] = [];
        for (const u of users) {
          const { data, error } = await supabaseAdmin.auth.admin.createUser({
            email: u.email,
            password: u.password,
            email_confirm: true,
            user_metadata: { display_name: u.display_name },
          });
          results.push({ email: u.email, id: data?.user?.id, error: error?.message });
        }
        return new Response(JSON.stringify(results), {
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});
