import { Router } from "express";
import { z } from "zod";
import { query } from "../db.js";
import { env } from "../env.js";
import { insertEvent } from "../lib/events.js";
import { buildVCard } from "../lib/vcard.js";
import { qrPng, qrSvg } from "../lib/qr.js";
import {
  appleWalletConfigured,
  buildApplePass,
} from "../lib/wallet-apple.js";
import {
  googleWalletConfigured,
  buildGoogleWalletSaveUrl,
} from "../lib/wallet-google.js";
import type { Employee, CompanySettings } from "./types.js";

export const publicRouter = Router();

const FIELDS = `id, slug, full_name, job_title, company, email, office_phone, mobile,
  website, linkedin, notes, photo_url, disabled, view_count, created_at, updated_at`;

async function loadActive(slug: string): Promise<Employee | null> {
  const rows = await query<Employee>(
    `SELECT ${FIELDS} FROM employees WHERE slug = ? AND disabled = 0 LIMIT 1`,
    [slug],
  );
  if (!rows[0]) return null;
  return { ...rows[0], disabled: !!rows[0].disabled };
}

function cardUrl(slug: string): string {
  return `${env.APP_ORIGIN.replace(/\/$/, "")}/card/${encodeURIComponent(slug)}`;
}

publicRouter.get("/cards/:slug", async (req, res) => {
  const emp = await loadActive(req.params.slug);
  if (!emp) return res.json({ employee: null, settings: null });
  const settings = await query<CompanySettings>(
    "SELECT company_name, brand_color, logo_url FROM company_settings WHERE id = 1",
  );
  res.json({ employee: emp, settings: settings[0] ?? null });
});

const EventSchema = z.object({
  slug: z.string().min(1).max(255),
  eventType: z.enum(["view", "scan"]),
  source: z.string().max(255).nullable().optional(),
  userAgent: z.string().max(512).nullable().optional(),
  referrer: z.string().max(512).nullable().optional(),
});

publicRouter.post("/events", async (req, res) => {
  const parsed = EventSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false });
  const emp = await loadActive(parsed.data.slug);
  if (!emp) return res.json({ ok: false });
  await insertEvent(emp.id, parsed.data.eventType === "scan" ? "qr_scan" : "view", req);
  res.json({ ok: true });
});

publicRouter.get("/vcard/:slug", async (req, res) => {
  const emp = await loadActive(req.params.slug);
  if (!emp) return res.status(404).send("Not found");
  await insertEvent(emp.id, "vcard_download", req);
  const body = buildVCard(emp);
  res.setHeader("Content-Type", "text/vcard; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${emp.slug}.vcf"`,
  );
  res.send(body);
});

publicRouter.get("/qr/:slug", async (req, res) => {
  const emp = await loadActive(req.params.slug);
  if (!emp) return res.status(404).send("Not found");
  const format = (req.query.format as string) === "svg" ? "svg" : "png";
  const url = cardUrl(emp.slug);
  if (format === "svg") {
    const svg = await qrSvg(url);
    res.setHeader("Content-Type", "image/svg+xml");
    return res.send(svg);
  }
  const png = await qrPng(url);
  res.setHeader("Content-Type", "image/png");
  res.send(png);
});

publicRouter.get("/wallet-status", (_req, res) => {
  res.json({ apple: appleWalletConfigured, google: googleWalletConfigured });
});



publicRouter.get("/wallet/:slug", async (req, res) => {
  if (!appleWalletConfigured) return res.status(501).send("Apple Wallet not configured");
  const emp = await loadActive(req.params.slug);
  if (!emp) return res.status(404).send("Not found");
  try {
    const buf = await buildApplePass(emp, cardUrl(emp.slug));
    await insertEvent(emp.id, "wallet_download", req);
    res.setHeader("Content-Type", "application/vnd.apple.pkpass");
    res.setHeader("Content-Disposition", `attachment; filename="${emp.slug}.pkpass"`);
    res.send(buf);
  } catch (err: any) {
    console.error("[apple-wallet] build failed:", err?.message ?? err);
    res.status(500).send(`Apple Wallet pass generation failed: ${err?.message ?? "unknown error"}`);
  }
});

publicRouter.get("/google-wallet/:slug", async (req, res) => {
  if (!googleWalletConfigured) return res.status(501).send("Google Wallet not configured");
  const emp = await loadActive(req.params.slug);
  if (!emp) return res.status(404).send("Not found");
  try {
    const url = buildGoogleWalletSaveUrl(emp, cardUrl(emp.slug));
    await insertEvent(emp.id, "wallet_download", req);
    res.redirect(302, url);
  } catch (err: any) {
    console.error("[google-wallet] build failed:", err?.message ?? err);
    res.status(500).send(`Google Wallet link generation failed: ${err?.message ?? "unknown error"}`);
  }
});
