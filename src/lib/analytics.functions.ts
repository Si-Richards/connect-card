import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Forbidden: admin role required");
}

/**
 * Records a public card view or QR scan. Called from public routes — no auth.
 * Writes go through the admin client; RLS still blocks anonymous reads.
 */
export const recordEmployeeEvent = createServerFn({ method: "POST" })
  .inputValidator((input: {
    slug: string;
    eventType: "view" | "scan";
    source?: string | null;
    userAgent?: string | null;
    referrer?: string | null;
  }) =>
    z
      .object({
        slug: z.string().min(1).max(64),
        eventType: z.enum(["view", "scan"]),
        source: z.string().max(64).nullish(),
        userAgent: z.string().max(512).nullish(),
        referrer: z.string().max(1024).nullish(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: emp } = await supabaseAdmin
      .from("employees")
      .select("id, disabled")
      .eq("slug", data.slug)
      .maybeSingle();
    if (!emp || emp.disabled) return { ok: false };

    await supabaseAdmin.from("employee_events").insert({
      employee_id: emp.id,
      event_type: data.eventType,
      source: data.source ?? null,
      user_agent: data.userAgent ?? null,
      referrer: data.referrer ?? null,
    });

    if (data.eventType === "view") {
      await supabaseAdmin.rpc("increment_employee_views", { _slug: data.slug });
    }
    return { ok: true };
  });

/** Per-employee totals + last-30-day counts, admin only. */
export const listEmployeeAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);

    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: rows, error } = await supabase
      .from("employee_events")
      .select("employee_id, event_type, occurred_at")
      .gte("occurred_at", since);
    if (error) throw new Error(error.message);

    const totals: Record<string, { views: number; scans: number }> = {};
    for (const r of rows ?? []) {
      const t = (totals[r.employee_id] ??= { views: 0, scans: 0 });
      if (r.event_type === "scan") t.scans++;
      else t.views++;
    }
    return { since, totals };
  });

/** Detailed daily breakdown for a single employee, last N days. */
export const getEmployeeAnalytics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; days?: number }) =>
    z.object({ id: z.string().uuid(), days: z.number().int().min(1).max(365).default(30) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);

    const days = data.days ?? 30;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const { data: rows, error } = await supabase
      .from("employee_events")
      .select("event_type, occurred_at, source, referrer")
      .eq("employee_id", data.id)
      .gte("occurred_at", since)
      .order("occurred_at", { ascending: false });
    if (error) throw new Error(error.message);

    const totals = { views: 0, scans: 0 };
    const daily: Record<string, { views: number; scans: number }> = {};
    for (let i = 0; i < days; i++) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      daily[d] = { views: 0, scans: 0 };
    }
    for (const r of rows ?? []) {
      const day = r.occurred_at.slice(0, 10);
      const bucket = (daily[day] ??= { views: 0, scans: 0 });
      if (r.event_type === "scan") {
        bucket.scans++;
        totals.scans++;
      } else {
        bucket.views++;
        totals.views++;
      }
    }
    const series = Object.entries(daily)
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([date, v]) => ({ date, ...v }));

    return {
      totals,
      series,
      recent: (rows ?? []).slice(0, 25),
    };
  });
