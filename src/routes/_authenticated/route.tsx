import { createFileRoute, Outlet, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useEffect } from "react";
import { api, ApiError } from "@/lib/api";

export const Route = createFileRoute("/_authenticated")({
  component: AdminLayout,
});

function AdminLayout() {
  const navigate = useNavigate();
  const router = useRouter();

  const meQ = useQuery({
    queryKey: ["auth-me"],
    queryFn: () => api.me(),
    retry: false,
    staleTime: 30_000,
  });

  const logoutM = useMutation({
    mutationFn: () => api.logout(),
    onSuccess: () => {
      router.invalidate();
      navigate({ to: "/login" });
    },
  });

  useEffect(() => {
    if (meQ.isError) {
      const err = meQ.error;
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        const here = window.location.pathname + window.location.search;
        navigate({ to: "/login", search: { redirect: here } });
      }
    }
  }, [meQ.isError, meQ.error, navigate]);

  if (meQ.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (!meQ.data?.user) {
    return null; // redirecting
  }

  if (!meQ.data.user.isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="max-w-md text-center space-y-3">
          <h1 className="text-xl font-semibold">Admin access required</h1>
          <p className="text-sm text-muted-foreground">
            Your account ({meQ.data.user.email}) doesn't have admin permissions.
          </p>
          <button
            onClick={() => logoutM.mutate()}
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm hover:bg-accent"
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
          <Link to="/admin" className="font-semibold tracking-tight">CardKit Admin</Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link to="/admin" activeOptions={{ exact: true }} activeProps={{ className: "text-foreground font-medium" }} className="text-muted-foreground hover:text-foreground">Employees</Link>
            <Link to="/admin/analytics" activeProps={{ className: "text-foreground font-medium" }} className="text-muted-foreground hover:text-foreground">Analytics</Link>
            <Link to="/admin/settings" activeProps={{ className: "text-foreground font-medium" }} className="text-muted-foreground hover:text-foreground">Settings</Link>
            <span className="text-muted-foreground hidden sm:inline">·</span>
            <span className="text-muted-foreground hidden sm:inline">{meQ.data.user.email}</span>
            <button
              onClick={() => logoutM.mutate()}
              className="text-muted-foreground hover:text-foreground"
              disabled={logoutM.isPending}
            >
              Sign out
            </button>
          </nav>
        </div>
      </header>
      <Outlet />
    </div>
  );
}
