import { createFileRoute, Link, useRouter } from "@tanstack/react-router";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Edit2, Trash2, ExternalLink, Copy, Download, EyeOff, Eye } from "lucide-react";
import {
  listEmployees,
  deleteEmployee,
  toggleEmployeeDisabled,
} from "@/lib/employees.functions";
import { listEmployeeAnalytics } from "@/lib/analytics.functions";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: AdminList,
});

function AdminList() {
  const router = useRouter();

  const q = useQuery({
    queryKey: ["employees"],
    queryFn: () => listEmployees({}),
  });
  const analyticsQ = useQuery({
    queryKey: ["employee-analytics-30d"],
    queryFn: () => listEmployeeAnalytics({}),
  });
  const totals = analyticsQ.data?.totals ?? {};
  const [search, setSearch] = useState("");


  const employees = (q.data?.employees ?? []).filter((e: any) =>
    !search || (e.full_name + " " + e.job_title + " " + e.email + " " + e.slug)
      .toLowerCase()
      .includes(search.toLowerCase()),
  );

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Employees</h1>
          <p className="text-sm text-muted-foreground">Manage digital business cards.</p>
        </div>
        <Link
          to="/admin/new"
          className="inline-flex items-center gap-2 rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:opacity-90"
        >
          <Plus className="w-4 h-4" /> New employee
        </Link>
      </div>

      <input
        placeholder="Search…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mt-4 w-full max-w-sm rounded-md border border-input bg-background px-3 py-2 text-sm"
      />

      <div className="mt-6 border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Slug</th>
              <th className="px-4 py-2 font-medium" title="All-time card views">Views</th>
              <th className="px-4 py-2 font-medium" title="Last 30 days">30d views</th>
              <th className="px-4 py-2 font-medium" title="QR scans, last 30 days">30d scans</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {q.isLoading && (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">Loading…</td></tr>
            )}
            {!q.isLoading && employees.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">No employees yet.</td></tr>
            )}
            {employees.map((e: any) => {
              const cardUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/card/${e.slug}`;
              const t = (totals as any)[e.id] ?? { views: 0, scans: 0 };
              return (
                <tr key={e.id} className="border-t border-border">
                  <td className="px-4 py-3">
                    <div className="font-medium">{e.full_name}</div>
                    <div className="text-xs text-muted-foreground">{e.job_title} {e.company && `· ${e.company}`}</div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{e.slug}</td>
                  <td className="px-4 py-3">{e.view_count}</td>
                  <td className="px-4 py-3 tabular-nums">{t.views}</td>
                  <td className="px-4 py-3 tabular-nums">{t.scans}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded ${e.disabled ? "bg-muted text-muted-foreground" : "bg-green-100 text-green-800"}`}>
                      {e.disabled ? "Disabled" : "Active"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <a href={`/card/${e.slug}`} target="_blank" rel="noreferrer" title="View" className="p-2 hover:bg-muted rounded">
                        <ExternalLink className="w-4 h-4" />
                      </a>
                      <button title="Copy link" onClick={() => navigator.clipboard.writeText(cardUrl)} className="p-2 hover:bg-muted rounded">
                        <Copy className="w-4 h-4" />
                      </button>
                      <a title="Download QR (PNG)" href={`/api/public/qr/${e.slug}?format=png`} download={`${e.slug}-qr.png`} className="p-2 hover:bg-muted rounded">
                        <Download className="w-4 h-4" />
                      </a>
                      <button
                        title={e.disabled ? "Enable" : "Disable"}
                        onClick={async () => { await toggleFn({ data: { id: e.id, disabled: !e.disabled } }); q.refetch(); }}
                        className="p-2 hover:bg-muted rounded"
                      >
                        {e.disabled ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                      </button>
                      <Link to="/admin/$id" params={{ id: e.id }} title="Edit" className="p-2 hover:bg-muted rounded">
                        <Edit2 className="w-4 h-4" />
                      </Link>
                      <button
                        title="Delete"
                        onClick={async () => {
                          if (!confirm(`Delete ${e.full_name}?`)) return;
                          await delFn({ data: { id: e.id } });
                          q.refetch();
                        }}
                        className="p-2 hover:bg-muted rounded text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
