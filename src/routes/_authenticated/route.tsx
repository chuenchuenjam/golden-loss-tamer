import { createFileRoute, Link, Outlet, redirect, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Upload,
  FileStack,
  Users,
  LogOut,
} from "lucide-react";


export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthLayout,
});

function AuthLayout() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
      setIsAdmin(!!data);
    })();
  }, [user.id]);

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const nav = [
    { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/upload", label: "New extraction", icon: Upload },
    { to: "/templates", label: "Templates", icon: FileStack },
  ] as const;
  const adminNav = [
    { to: "/admin/team", label: "Team", icon: Users },
  ] as const;


  return (
    <div className="min-h-screen flex bg-muted/30">
      <aside className="w-60 shrink-0 border-r bg-background flex flex-col">
        <div className="p-4 border-b">
          <div className="font-semibold text-sm">Loss Run Extractor</div>
          <div className="text-xs text-muted-foreground truncate">{user.email}</div>
        </div>
        <nav className="flex-1 p-2 space-y-0.5">
          {nav.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className={cn(
                "flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-accent",
                pathname.startsWith(n.to) && "bg-accent font-medium",
              )}
            >
              <n.icon className="h-4 w-4" /> {n.label}
            </Link>
          ))}
          {isAdmin && (
            <>
              <div className="mt-4 mb-1 px-3 text-xs uppercase text-muted-foreground">Admin</div>
              {adminNav.map((n) => (
                <Link
                  key={n.to}
                  to={n.to}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-accent",
                    pathname.startsWith(n.to) && "bg-accent font-medium",
                  )}
                >
                  <n.icon className="h-4 w-4" /> {n.label}
                </Link>
              ))}
            </>
          )}
        </nav>
        <div className="p-2 border-t">
          <Button variant="ghost" size="sm" className="w-full justify-start" onClick={signOut}>
            <LogOut className="h-4 w-4 mr-2" /> Sign out
          </Button>
        </div>
      </aside>
      <main className="flex-1 min-w-0 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
