import { createFileRoute, Outlet, Link } from "@tanstack/react-router";

/**
 * Auth was removed when this project was switched to self-hosted mode.
 * The admin section is now open — re-add a guard here if you need one.
 */
export const Route = createFileRoute("/_authenticated")({
  component: AdminLayout,
});

function AdminLayout() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
          <Link to="/admin" className="font-semibold tracking-tight">CardKit Admin</Link>
        </div>
      </header>
      <Outlet />
    </div>
  );
}
