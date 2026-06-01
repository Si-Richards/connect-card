import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, QrCode, Download, Wallet, FileImage, FileCode2, Link2, Check, RefreshCw } from "lucide-react";
import { useState } from "react";
import { EmployeeForm } from "./admin.new";
import { getEmployeeAnalytics } from "@/lib/analytics.functions";
import { getEmployee } from "@/lib/employees.functions";
import { api } from "@/lib/api";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/$id")({
  component: EditPage,
});

function EditPage() {
  const { id } = Route.useParams();
  return (
    <div className="space-y-8">
      <EmployeeForm mode={{ kind: "edit", id }} />
      <div className="max-w-3xl mx-auto px-6 space-y-6">
        <QrPanel id={id} />
      </div>
      <div className="max-w-3xl mx-auto px-6 pb-12">
        <AnalyticsPanel id={id} />
      </div>
    </div>
  );
}

function QrPanel({ id }: { id: string }) {
  const q = useQuery({
    queryKey: ["employee", id],
    queryFn: () => getEmployee({ data: { id } }),
  });
  const qc = useQueryClient();
  const [copied, setCopied] = useState(false);
  const rotate = useMutation({
    mutationFn: () => api.rotateEmployeePublicId(id),
    onSuccess: () => {
      toast.success("New link issued. Old QR and URL no longer work.");
      qc.invalidateQueries({ queryKey: ["employee", id] });
    },
    onError: (err: any) => toast.error(err?.message ?? "Failed to rotate link"),
  });

  if (q.isLoading) return null;
  if (q.isError || !q.data?.employee) return null;
  const e = q.data.employee;
  const cardUrl = typeof window !== "undefined"
    ? `${window.location.origin}/c/${e.public_id}`
    : `/c/${e.public_id}`;
  const qrBase = `/api/public/qr/${encodeURIComponent(e.public_id)}`;

  return (
    <section className="rounded-lg border border-border p-5 bg-card">
      <header className="mb-4">
        <h2 className="text-lg font-semibold">Public card link &amp; QR</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Print the QR or share the link. Scans are tracked automatically.
        </p>
      </header>
      <div className="flex flex-col sm:flex-row gap-5 items-start">
        <div className="bg-white p-3 rounded-lg border border-border shrink-0">
          <img src={`${qrBase}?format=svg`} alt={`QR for ${e.full_name}`} className="w-36 h-36 block" />
        </div>
        <div className="flex-1 w-full space-y-3 min-w-0">
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={cardUrl}
              onFocus={(ev) => ev.currentTarget.select()}
              className="flex-1 min-w-0 rounded-md border border-input bg-background px-3 py-2 text-xs font-mono"
            />
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(cardUrl);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                } catch { /* ignore */ }
              }}
              className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-2 text-xs font-medium hover:bg-accent"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Link2 className="w-3.5 h-3.5" />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={`${qrBase}?format=png&download=1`}
              download={`${e.slug}-qr.png`}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90"
            >
              <FileImage className="w-3.5 h-3.5" />
              Download PNG
            </a>
            <a
              href={`${qrBase}?format=svg&download=1`}
              download={`${e.slug}-qr.svg`}
              className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-2 text-xs font-medium hover:bg-accent"
            >
              <FileCode2 className="w-3.5 h-3.5" />
              Download SVG
            </a>
            <a
              href={cardUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-2 text-xs font-medium hover:bg-accent"
            >
              <Link2 className="w-3.5 h-3.5" />
              Open card
            </a>
            <button
              type="button"
              disabled={rotate.isPending}
              onClick={() => {
                if (window.confirm("Revoke this card's link? The old URL and any printed QR will stop working immediately. A new QR will be generated.")) {
                  rotate.mutate();
                }
              }}
              className="inline-flex items-center gap-1.5 rounded-md border border-destructive/40 bg-background px-3 py-2 text-xs font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${rotate.isPending ? "animate-spin" : ""}`} />
              {rotate.isPending ? "Revoking…" : "Revoke & reissue"}
            </button>
          </div>
        </div>
      </div>
    </section>
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
          const bar = (value: number, tone: 1 | 2 | 3 | 4) => (
            <div
              style={{
                height: `${(value / max) * 100}%`,
                minHeight: value ? 2 : 0,
                backgroundColor: `color-mix(in oklab, var(--chart-${tone}) 70%, transparent)`,
              }}
            />
          );
          return (
            <div
              key={d.date}
              className="flex-1 flex flex-col-reverse gap-px"
              title={`${d.date}: ${d.views}v / ${d.scans}s / ${d.vcards}vc / ${d.wallets}w`}
            >
              {bar(d.views, 1)}
              {bar(d.scans, 2)}
              {bar(d.vcards, 3)}
              {bar(d.wallets, 4)}
              <div className="opacity-0" style={{ height: `${100 - (total / max) * 100}%` }} />
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground mb-6">
        <Legend tone={1} label="Views" />
        <Legend tone={2} label="Scans" />
        <Legend tone={3} label="vCard" />
        <Legend tone={4} label="Wallet" />
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

function Legend({ tone, label }: { tone: 1 | 2 | 3 | 4; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="w-2 h-2 rounded-sm"
        style={{ backgroundColor: `color-mix(in oklab, var(--chart-${tone}) 70%, transparent)` }}
      />
      {label}
    </span>
  );
}
