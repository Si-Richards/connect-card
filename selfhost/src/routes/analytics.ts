import { Router } from "express";
import { z } from "zod";
import { query } from "../db.js";
import { requireAdmin } from "../auth.js";

export const analyticsRouter = Router();
analyticsRouter.use(requireAdmin);

const DaysSchema = z.coerce.number().int().min(1).max(365).default(30);

type Row = { date: string; event_type: string; n: number };

function emptyBucket() {
  return { views: 0, scans: 0, vcards: 0, wallets: 0, bookings: 0 };
}

function bumpBucket(b: ReturnType<typeof emptyBucket>, type: string, n: number) {
  if (type === "view") b.views += n;
  else if (type === "qr_scan") b.scans += n;
  else if (type === "vcard_download") b.vcards += n;
  else if (type === "wallet_download") b.wallets += n;
  else if (type === "booking_click") b.bookings += n;
}

analyticsRouter.get("/summary", async (req, res) => {
  const days = DaysSchema.parse(req.query.days);
  const rows = await query<Row & { employee_id: string }>(
    `SELECT employee_id,
            DATE(created_at) AS date,
            event_type,
            COUNT(*) AS n
     FROM card_events
     WHERE created_at >= (NOW() - INTERVAL ? DAY)
     GROUP BY employee_id, DATE(created_at), event_type`,
    [days],
  );

  const totals: Record<string, ReturnType<typeof emptyBucket>> = {};
  const dailyMap = new Map<string, ReturnType<typeof emptyBucket>>();
  for (const r of rows) {
    const t = (totals[r.employee_id] ??= emptyBucket());
    bumpBucket(t, r.event_type, Number(r.n));
    const d = dailyMap.get(r.date) ?? emptyBucket();
    bumpBucket(d, r.event_type, Number(r.n));
    dailyMap.set(r.date, d);
  }
  const series = [...dailyMap.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([date, b]) => ({ date, ...b }));

  res.json({
    since: new Date(Date.now() - days * 86400000).toISOString(),
    days,
    totals,
    series,
  });
});

analyticsRouter.get("/employees/:id", async (req, res) => {
  const days = DaysSchema.parse(req.query.days);
  const emp = await query<{ id: string; full_name: string; slug: string; public_id: string }>(
    "SELECT id, full_name, slug, public_id FROM employees WHERE id = ?",
    [req.params.id],
  );
  if (!emp[0]) return res.status(404).json({ error: "Not found" });

  const rows = await query<Row>(
    `SELECT DATE(created_at) AS date, event_type, COUNT(*) AS n
     FROM card_events
     WHERE employee_id = ? AND created_at >= (NOW() - INTERVAL ? DAY)
     GROUP BY DATE(created_at), event_type`,
    [req.params.id, days],
  );

  const totals = emptyBucket();
  const dailyMap = new Map<string, ReturnType<typeof emptyBucket>>();
  for (const r of rows) {
    bumpBucket(totals, r.event_type, Number(r.n));
    const d = dailyMap.get(r.date) ?? emptyBucket();
    bumpBucket(d, r.event_type, Number(r.n));
    dailyMap.set(r.date, d);
  }
  const series = [...dailyMap.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([date, b]) => ({ date, ...b }));

  const recent = await query<{
    event_type: string;
    occurred_at: string;
    user_agent: string | null;
    referrer: string | null;
  }>(
    `SELECT event_type, created_at AS occurred_at, user_agent, referrer
     FROM card_events
     WHERE employee_id = ?
     ORDER BY created_at DESC
     LIMIT 50`,
    [req.params.id],
  );

  res.json({
    employee: emp[0],
    since: new Date(Date.now() - days * 86400000).toISOString(),
    days,
    totals,
    series,
    recent,
  });
});
