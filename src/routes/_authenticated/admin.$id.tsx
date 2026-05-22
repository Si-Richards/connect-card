import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Eye, QrCode, Download, Wallet } from "lucide-react";
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

const EVENT_LABEL: Record<string, string> = {
  view: "View",
  qr_scan: "QR scan",
  vcard_download: "vCard",
  wallet_download: "Wallet",
};

function AnalyticsPanel({ id }: { id: string }) {
  const q = useQuery({
    queryKey: ["employee-analytics", id],
    queryFn: () => getEmployeeAnalytics({ data: { id, days: 30 } }),
  });

  if (q.isLoading) return <div className="text-sm text-muted-foreground">Loading analytics…</div>;
  if (q.isError || !q.data) return <div className="text-sm text-muted-foreground">Couldn't load analytics.</div>;

  const { totals, series, recent } = q.data;
  const max = Math.max(1, ...series.map((d) => d.views + d.scans + d.vcards + d.wallets));

  return (
    <section className="rounded-lg border border-border p-5 bg-card">
      <header className="flex items-baseline justify-between mb-4">
        <h2 className="text-lg font-semibold">Analytics</h2>
        <span className="text-xs text-muted-foreground">Last 30 days</span>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Stat label="Views" value={totals.views} icon={<Eye className="w-4 h-4" />} />
        <Stat label="QR scans" value={totals.scans} icon={<QrCode className="w-4 h-4" />} />
        <Stat label="vCard" value={totals.vcards} icon={<Download className="w-4 h-4" />} />
        <Stat label="Wallet" value={totals.wallets} icon={<Wallet className="w-4 h-4" />} />
      </div>

      <div className="flex items-end gap-1 h-24 mb-2">
        {series.map((d) => {
          const total = d.views + d.scans + d.vcards + d.wallets;
          return (
            <div
              key={d.date}
              className="flex-1 flex flex-col-reverse gap-px"
              title={`${d.date}: ${d.views}v / ${d.scans}s / ${d.vcards}vc / ${d.wallets}w`}
            >
              <div className="bg-primary/30" style={{ height: `${(d.views / max) * 100}%`, minHeight: d.views ? 2 : 0 }} />
              <div className="bg-primary" style={{ height: `${(d.scans / max) * 100}%`, minHeight: d.scans ? 2 : 0 }} />
              <div className="bg-amber-500/70" style={{ height: `${(d.vcards / max) * 100}%`, minHeight: d.vcards ? 2 : 0 }} />
              <div className="bg-violet-500/70" style={{ height: `${(d.wallets / max) * 100}%`, minHeight: d.wallets ? 2 : 0 }} />
              <div className="opacity-0" style={{ height: `${100 - (total / max) * 100}%` }} />
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground mb-6">
        <Legend swatch="bg-primary/30" label="Views" />
        <Legend swatch="bg-primary" label="Scans" />
        <Legend swatch="bg-amber-500/70" label="vCard" />
        <Legend swatch="bg-violet-500/70" label="Wallet" />
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
                <th className="px-3 py-2 font-medium">User agent</th>
                <th className="px-3 py-2 font-medium">Referrer</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((r, i) => (
                <tr key={i} className="border-t border-border">
                  <td className="px-3 py-2 whitespace-nowrap">{new Date(r.occurred_at).toLocaleString()}</td>
                  <td className="px-3 py-2">
                    <span className="px-1.5 py-0.5 rounded bg-muted">
                      {EVENT_LABEL[r.event_type] ?? r.event_type}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground truncate max-w-[18rem]" title={r.user_agent || ""}>
                    {r.user_agent || "—"}
                  </td>
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

function Stat({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
        <span className="text-muted-foreground">{icon}</span>
      </div>
      <div className="text-2xl font-semibold tabular-nums mt-1">{value.toLocaleString()}</div>
    </div>
  );
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`w-2 h-2 rounded-sm ${swatch}`} /> {label}
    </span>
  );
}
