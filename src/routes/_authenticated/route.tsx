import { createFileRoute, redirect, Outlet, Link, useRouter } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({ to: "/login" });
    }
  },
  component: AuthLayout,
});

function AuthLayout() {
  const router = useRouter();
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
          <Link to="/admin" className="font-semibold tracking-tight">CardKit Admin</Link>
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              router.navigate({ to: "/login" });
            }}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Sign out
          </button>
        </div>
      </header>
      <Outlet />
    </div>
  );
}
