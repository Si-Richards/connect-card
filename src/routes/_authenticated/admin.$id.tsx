import { createFileRoute } from "@tanstack/react-router";

import { useQuery } from "@tanstack/react-query";
import { EmployeeForm } from "./admin.new";
import { getEmployeeAnalytics } from "@/lib/analytics.functions";

export const Route = createFileRoute("/_authenticated/admin/$id")({
  component: EditPage,
});

function EditPage() {
  const { id } = Route.useParams();
  return (
    <div className="space-y-8">
      <EmployeeForm mode={{ kind: "edit", id }} />
      <div className="max-w-3xl mx-auto px-6 pb-12">
        <AnalyticsPanel id={id} />
      </div>
    </div>
  );
}

function AnalyticsPanel({ id }: { id: string }) {
  const fn = getEmployeeAnalytics;
  const q = useQuery({
    queryKey: ["employee-analytics", id],
    queryFn: () => fn({ data: { id, days: 30 } }),
  });

  if (q.isLoading) {
    return <div className="text-sm text-muted-foreground">Loading analytics…</div>;
  }
  if (q.isError || !q.data) {
    return <div className="text-sm text-muted-foreground">Couldn't load analytics.</div>;
  }

  const { totals, series, recent } = q.data;
  const max = Math.max(1, ...series.map((d: any) => d.views + d.scans));

  return (
    <section className="rounded-lg border border-border p-5 bg-card">
      <header className="flex items-baseline justify-between mb-4">
        <h2 className="text-lg font-semibold">Analytics</h2>
        <span className="text-xs text-muted-foreground">Last 30 days</span>
      </header>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <Stat label="Card views" value={totals.views} />
        <Stat label="QR scans" value={totals.scans} />
      </div>

      <div className="flex items-end gap-1 h-24 mb-2">
        {series.map((d: any) => {
          const h = ((d.views + d.scans) / max) * 100;
          return (
            <div
              key={d.date}
              className="flex-1 flex flex-col-reverse gap-px"
              title={`${d.date}: ${d.views} views, ${d.scans} scans`}
            >
              <div
                className="bg-primary/30 rounded-sm"
                style={{ height: `${(d.views / max) * 100}%`, minHeight: d.views ? 2 : 0 }}
              />
              <div
                className="bg-primary rounded-sm"
                style={{ height: `${(d.scans / max) * 100}%`, minHeight: d.scans ? 2 : 0 }}
              />
              <div className="opacity-0" style={{ height: `${100 - h}%` }} />
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-4 text-xs text-muted-foreground mb-6">
        <span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-primary" /> Scans</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-primary/30" /> Views</span>
      </div>

      <h3 className="text-sm font-medium mb-2">Recent events</h3>
      {recent.length === 0 ? (
        <p className="text-sm text-muted-foreground">No events recorded yet.</p>
      ) : (
        <div className="border border-border rounded-md overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-3 py-2 font-medium">When</th>
                <th className="px-3 py-2 font-medium">Type</th>
                <th className="px-3 py-2 font-medium">Source</th>
                <th className="px-3 py-2 font-medium">Referrer</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((r: any, i: number) => (
                <tr key={i} className="border-t border-border">
                  <td className="px-3 py-2 whitespace-nowrap">{new Date(r.occurred_at).toLocaleString()}</td>
                  <td className="px-3 py-2">
                    <span className={`px-1.5 py-0.5 rounded ${r.event_type === "scan" ? "bg-primary/10 text-primary" : "bg-muted"}`}>
                      {r.event_type}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{r.source || "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground truncate max-w-[16rem]">{r.referrer || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-border p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-3xl font-semibold tabular-nums mt-1">{value}</div>
    </div>
  );
}
