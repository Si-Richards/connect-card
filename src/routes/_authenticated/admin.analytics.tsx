import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { Eye, QrCode, Download, Wallet } from "lucide-react";
import { listEmployees } from "@/lib/employees.functions";
import {
  listEmployeeAnalytics,
  getEmployeeAnalytics,
} from "@/lib/analytics.functions";
import type {
  AnalyticsSummary,
  AnalyticsDetail,
  EventBucket,
} from "@/lib/api";

export const Route = createFileRoute("/_authenticated/admin/analytics")({
  component: AnalyticsPage,
});

const RANGES = [7, 30, 90] as const;
type Range = (typeof RANGES)[number];

function sumTotals(totals: Record<string, EventBucket>): EventBucket {
  const out: EventBucket = { views: 0, scans: 0, vcards: 0, wallets: 0 };
  for (const k of Object.keys(totals)) {
    out.views += totals[k].views;
    out.scans += totals[k].scans;
    out.vcards += totals[k].vcards;
    out.wallets += totals[k].wallets;
  }
  return out;
}

function StatCard({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  tone: 1 | 2 | 3 | 4;
}) {
  const color = `var(--chart-${tone})`;
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
        <span
          className="w-8 h-8 rounded-md flex items-center justify-center"
          style={{
            backgroundColor: `color-mix(in oklab, ${color} 18%, transparent)`,
            color,
          }}
        >
          {icon}
        </span>
      </div>
      <div className="mt-2 text-3xl font-semibold tabular-nums">{value.toLocaleString()}</div>
    </div>
  );
}

function AnalyticsPage() {
  const [days, setDays] = useState<Range>(30);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const employeesQ = useQuery({
    queryKey: ["employees"],
    queryFn: () => listEmployees({}),
  });

  const summaryQ = useQuery<AnalyticsSummary>({
    queryKey: ["analytics-summary", days],
    queryFn: () => listEmployeeAnalytics({ data: { days } }),
  });

  const detailQ = useQuery<AnalyticsDetail>({
    queryKey: ["analytics-employee", selectedId, days],
    queryFn: () =>
      getEmployeeAnalytics({ data: { id: selectedId as string, days } }),
    enabled: !!selectedId,
  });

  const employees = employeesQ.data?.employees ?? [];
  const totals = summaryQ.data?.totals ?? {};
  const series = summaryQ.data?.series ?? [];
  const overall = useMemo(() => sumTotals(totals), [totals]);

  const tableRows = useMemo(() => {
    return employees
      .map((e: any) => ({
        ...e,
        t: totals[e.id] ?? { views: 0, scans: 0, vcards: 0, wallets: 0 },
      }))
      .sort(
        (a: any, b: any) =>
          b.t.views + b.t.scans + b.t.vcards + b.t.wallets -
          (a.t.views + a.t.scans + a.t.vcards + a.t.wallets),
      );
  }, [employees, totals]);


  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Analytics</h1>
          <p className="text-sm text-muted-foreground">
            Card activity across all employees, last {days} days.
          </p>
        </div>
        <div className="inline-flex rounded-md border border-border bg-card p-1 text-sm">
          {RANGES.map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-3 py-1 rounded ${days === d ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {/* Overall stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Card views" value={overall.views} icon={<Eye className="w-4 h-4" />} tone={1} />
        <StatCard label="QR scans" value={overall.scans} icon={<QrCode className="w-4 h-4" />} tone={2} />
        <StatCard label="vCard downloads" value={overall.vcards} icon={<Download className="w-4 h-4" />} tone={3} />
        <StatCard label="Wallet passes" value={overall.wallets} icon={<Wallet className="w-4 h-4" />} tone={4} />
      </div>

      {/* Global series */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h2 className="text-sm font-medium text-muted-foreground">Activity over time</h2>
        <div className="h-72 mt-3">
          {summaryQ.isLoading ? (
            <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Loading…</div>
          ) : summaryQ.isError ? (
            <div className="h-full flex items-center justify-center text-sm text-destructive">Couldn't load analytics.</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id="g-views" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="g-scans" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="g-vcards" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-3)" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="var(--chart-3)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="g-wallets" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-4)" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="var(--chart-4)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(d) => d.slice(5)} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, color: "var(--foreground)" }}
                  labelStyle={{ color: "var(--foreground)" }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area type="monotone" dataKey="views" name="Views" stroke="var(--chart-1)" fill="url(#g-views)" strokeWidth={2} />
                <Area type="monotone" dataKey="scans" name="QR scans" stroke="var(--chart-2)" fill="url(#g-scans)" strokeWidth={2} />
                <Area type="monotone" dataKey="vcards" name="vCard" stroke="var(--chart-3)" fill="url(#g-vcards)" strokeWidth={2} />
                <Area type="monotone" dataKey="wallets" name="Wallet" stroke="var(--chart-4)" fill="url(#g-wallets)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Per-employee table */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-medium">Per employee · last {days} days</h2>
          {selectedId && (
            <button
              onClick={() => setSelectedId(null)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Clear selection
            </button>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left">
              <tr>
                <th className="px-4 py-2 font-medium">Employee</th>
                <th className="px-4 py-2 font-medium tabular-nums">Views</th>
                <th className="px-4 py-2 font-medium tabular-nums">QR scans</th>
                <th className="px-4 py-2 font-medium tabular-nums">vCard</th>
                <th className="px-4 py-2 font-medium tabular-nums">Wallet</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.length === 0 && !employeesQ.isLoading && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">No employees yet.</td></tr>
              )}
              {tableRows.map((e: any) => {
                const active = selectedId === e.id;
                return (
                  <tr
                    key={e.id}
                    onClick={() => setSelectedId(active ? null : e.id)}
                    className={`border-t border-border cursor-pointer hover:bg-muted/30 ${active ? "bg-muted/40" : ""}`}
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium">{e.full_name}</div>
                      <div className="text-xs text-muted-foreground font-mono">{e.slug}</div>
                    </td>
                    <td className="px-4 py-3 tabular-nums">{e.t.views}</td>
                    <td className="px-4 py-3 tabular-nums">{e.t.scans}</td>
                    <td className="px-4 py-3 tabular-nums">{e.t.vcards}</td>
                    <td className="px-4 py-3 tabular-nums">{e.t.wallets}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Employee detail */}
      {selectedId && (
        <div className="rounded-lg border border-border bg-card p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium">
              {detailQ.data?.employee.full_name ?? "Employee"} · last {days} days
            </h2>
            {detailQ.data && (
              <a
                href={`/card/${detailQ.data.employee.slug}`}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-muted-foreground hover:text-foreground underline"
              >
                Open card
              </a>
            )}
          </div>

          {detailQ.isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}

          {detailQ.data && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard label="Views" value={detailQ.data.totals.views} icon={<Eye className="w-4 h-4" />} tone={1} />
                <StatCard label="QR scans" value={detailQ.data.totals.scans} icon={<QrCode className="w-4 h-4" />} tone={2} />
                <StatCard label="vCard" value={detailQ.data.totals.vcards} icon={<Download className="w-4 h-4" />} tone={3} />
                <StatCard label="Wallet" value={detailQ.data.totals.wallets} icon={<Wallet className="w-4 h-4" />} tone={4} />
              </div>

              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={detailQ.data.series} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(d) => d.slice(5)} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, color: "var(--foreground)" }}
                      labelStyle={{ color: "var(--foreground)" }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Area type="monotone" dataKey="views" name="Views" stroke="var(--chart-1)" fill="var(--chart-1)" fillOpacity={0.15} strokeWidth={2} />
                    <Area type="monotone" dataKey="scans" name="QR scans" stroke="var(--chart-2)" fill="var(--chart-2)" fillOpacity={0.15} strokeWidth={2} />
                    <Area type="monotone" dataKey="vcards" name="vCard" stroke="var(--chart-3)" fill="var(--chart-3)" fillOpacity={0.15} strokeWidth={2} />
                    <Area type="monotone" dataKey="wallets" name="Wallet" stroke="var(--chart-4)" fill="var(--chart-4)" fillOpacity={0.15} strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div>
                <h3 className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Recent events</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="text-left text-muted-foreground">
                      <tr>
                        <th className="py-1 pr-3 font-medium">When</th>
                        <th className="py-1 pr-3 font-medium">Type</th>
                        <th className="py-1 pr-3 font-medium">Referrer</th>
                        <th className="py-1 pr-3 font-medium">User agent</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailQ.data.recent.length === 0 && (
                        <tr><td colSpan={4} className="py-3 text-center text-muted-foreground">No events yet.</td></tr>
                      )}
                      {detailQ.data.recent.map((r, i) => (
                        <tr key={i} className="border-t border-border">
                          <td className="py-1.5 pr-3 tabular-nums">{new Date(r.occurred_at).toLocaleString()}</td>
                          <td className="py-1.5 pr-3">{r.event_type}</td>
                          <td className="py-1.5 pr-3 max-w-[200px] truncate" title={r.referrer ?? ""}>{r.referrer || "—"}</td>
                          <td className="py-1.5 pr-3 max-w-[260px] truncate" title={r.user_agent ?? ""}>{r.user_agent || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
