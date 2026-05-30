import { Router, type Request, type Response, type NextFunction } from "express";
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
import { signResource, verifyResource, type ResourceKind } from "../lib/signed-url.js";
import type { Employee, CompanySettings } from "./types.js";

export const publicRouter = Router();

const FIELDS = `id, slug, full_name, job_title, company, email, office_phone, mobile,
  website, linkedin, notes, photo_url, address, disabled, view_count, created_at, updated_at`;

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

// Public DTO — drops internal fields (notes, id, view_count, timestamps, disabled).
function toPublicCard(e: Employee) {
  return {
    slug: e.slug,
    full_name: e.full_name,
    job_title: e.job_title,
    company: e.company,
    email: e.email,
    office_phone: e.office_phone,
    mobile: e.mobile,
    website: e.website,
    linkedin: e.linkedin,
    address: e.address,
    photo_url: e.photo_url,
  };
}

// ---- Anti-scraping helpers ----

const BOT_UA = /(curl|wget|python-requests|httpie|go-http-client|libwww-perl|scrapy|java-http-client)/i;

function looksLikeBrowser(req: Request): boolean {
  const accept = (req.headers["accept"] as string | undefined)?.trim();
  const ua = (req.headers["user-agent"] as string | undefined)?.trim();
  if (!accept) return false;
  if (!ua) return false;
  if (BOT_UA.test(ua)) return false;
  return true;
}

function noIndex(res: Response) {
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
}

function noStore(res: Response) {
  res.setHeader("Cache-Control", "private, no-store");
}

function browserOnly(req: Request, res: Response, next: NextFunction) {
  if (!looksLikeBrowser(req)) return res.status(403).send("Forbidden");
  next();
}

function sameOriginReferer(req: Request): boolean {
  const ref = req.headers["referer"] as string | undefined;
  if (!ref) return true; // missing referer is allowed (privacy modes)
  try {
    return new URL(ref).origin === new URL(env.APP_ORIGIN).origin;
  } catch {
    return false;
  }
}

// ---- Routes ----

publicRouter.get("/cards/:slug", browserOnly, async (req, res) => {
  noIndex(res);
  noStore(res);
  const emp = await loadActive(req.params.slug);
  if (!emp) return res.json({ employee: null, settings: null, tokens: null });
  const settings = await query<CompanySettings>(
    "SELECT company_name, brand_color, logo_url FROM company_settings WHERE id = 1",
  );
  const tokens = {
    vcard: signResource(emp.slug, "vcard"),
    apple: signResource(emp.slug, "apple"),
    google: signResource(emp.slug, "google"),
  };
  res.json({
    employee: toPublicCard(emp),
    settings: settings[0] ?? null,
    tokens,
  });
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
  if (!sameOriginReferer(req)) return res.json({ ok: false });
  const emp = await loadActive(parsed.data.slug);
  if (!emp) return res.json({ ok: false });
  await insertEvent(emp.id, parsed.data.eventType === "scan" ? "qr_scan" : "view", req);
  res.json({ ok: true });
});

function requireToken(kind: ResourceKind) {
  return (req: Request, res: Response, next: NextFunction) => {
    const exp = req.query.exp as string | undefined;
    const sig = req.query.sig as string | undefined;
    if (!verifyResource(req.params.slug, kind, exp, sig)) {
      return res.status(403).send("Forbidden");
    }
    next();
  };
}

publicRouter.get("/vcard/:slug", browserOnly, requireToken("vcard"), async (req, res) => {
  noIndex(res);
  noStore(res);
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
  noIndex(res);
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

publicRouter.get("/wallet/:slug", browserOnly, requireToken("apple"), async (req, res) => {
  noIndex(res);
  noStore(res);
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

publicRouter.get("/google-wallet/:slug", browserOnly, requireToken("google"), async (req, res) => {
  noIndex(res);
  noStore(res);
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
