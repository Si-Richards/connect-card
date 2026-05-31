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
import { resolveBranding, type Branding } from "./types.js";
import type { Employee, CompanySettings } from "./types.js";

export const publicRouter = Router();

const FIELDS = `id, slug, public_id, full_name, job_title, company, email, office_phone, mobile,
  website, linkedin, notes, photo_url, address,
  brand_color, accent_color, logo_url, cover_image_url, booking_url,
  disabled, view_count, created_at, updated_at`;

// All public lookups go through public_id — unguessable, prevents enumeration.
async function loadActiveByPublicId(publicId: string): Promise<Employee | null> {
  const rows = await query<Employee>(
    `SELECT ${FIELDS} FROM employees WHERE public_id = ? AND disabled = 0 LIMIT 1`,
    [publicId],
  );
  if (!rows[0]) return null;
  return { ...rows[0], disabled: !!rows[0].disabled };
}

async function loadSettings(): Promise<CompanySettings | null> {
  const rows = await query<CompanySettings>(
    "SELECT company_name, brand_color, accent_color, logo_url, cover_image_url FROM company_settings WHERE id = 1",
  );
  return rows[0] ?? null;
}

function cardUrl(publicId: string): string {
  return `${env.APP_ORIGIN.replace(/\/$/, "")}/c/${encodeURIComponent(publicId)}`;
}

// Public DTO — drops slug and other internal fields. Slug is admin-only now.
function toPublicCard(e: Employee, branding: Branding) {
  return {
    public_id: e.public_id,
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
    booking_url: e.booking_url,
    branding,
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
  if (!ref) return true;
  try {
    return new URL(ref).origin === new URL(env.APP_ORIGIN).origin;
  } catch {
    return false;
  }
}

// ---- Very small in-memory IP rate limiter ----
// 30 req / minute / IP on the card lookup. Brute-forcing 22 chars of
// base32 (≈110 bits) is already infeasible; this just makes scraping noisy.

const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 30;
const hits = new Map<string, number[]>();

function rateLimitLookup(req: Request, res: Response, next: NextFunction) {
  const ip =
    (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ||
    req.socket.remoteAddress ||
    "unknown";
  const now = Date.now();
  const arr = (hits.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  arr.push(now);
  hits.set(ip, arr);
  if (arr.length > RATE_MAX) return res.status(429).json({ error: "Too many requests" });
  next();
}

// Slug-based public lookup is GONE — kill the enumeration vector entirely.
publicRouter.get("/cards/:slug", (_req, res) => {
  noIndex(res);
  res.status(404).json({ employee: null, settings: null, tokens: null });
});

// ---- Card lookup by public_id ----

publicRouter.get("/c/:publicId", browserOnly, rateLimitLookup, async (req, res) => {
  noIndex(res);
  noStore(res);
  const emp = await loadActiveByPublicId(req.params.publicId);
  if (!emp) return res.json({ employee: null, settings: null, tokens: null });
  const settings = await loadSettings();
  const branding = resolveBranding(emp, settings);
  const tokens = {
    vcard: signResource(emp.public_id, "vcard"),
    apple: signResource(emp.public_id, "apple"),
    google: signResource(emp.public_id, "google"),
  };
  res.json({
    employee: toPublicCard(emp, branding),
    settings,
    tokens,
  });
});

const EventSchema = z.object({
  publicId: z.string().min(1).max(64),
  eventType: z.enum(["view", "scan", "booking_click"]),
  source: z.string().max(255).nullable().optional(),
  userAgent: z.string().max(512).nullable().optional(),
  referrer: z.string().max(512).nullable().optional(),
});

publicRouter.post("/events", async (req, res) => {
  const parsed = EventSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false });
  if (!sameOriginReferer(req)) return res.json({ ok: false });
  const emp = await loadActiveByPublicId(parsed.data.publicId);
  if (!emp) return res.json({ ok: false });
  const t = parsed.data.eventType;
  const dbType = t === "scan" ? "qr_scan" : t === "booking_click" ? "booking_click" : "view";
  await insertEvent(emp.id, dbType, req);
  res.json({ ok: true });
});

function requireToken(kind: ResourceKind) {
  return (req: Request, res: Response, next: NextFunction) => {
    const exp = req.query.exp as string | undefined;
    const sig = req.query.sig as string | undefined;
    if (!verifyResource(req.params.publicId, kind, exp, sig)) {
      return res.status(403).send("Forbidden");
    }
    next();
  };
}

publicRouter.get("/vcard/:publicId", browserOnly, requireToken("vcard"), async (req, res) => {
  noIndex(res);
  noStore(res);
  const emp = await loadActiveByPublicId(req.params.publicId);
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

// QR code — encodes /c/:public_id. Admin-only (requireToken not used; gated
// by the admin UI calling /api/employees/:id/qr-url which returns this).
publicRouter.get("/qr/:publicId", async (req, res) => {
  noIndex(res);
  const emp = await loadActiveByPublicId(req.params.publicId);
  if (!emp) return res.status(404).send("Not found");
  const settings = await loadSettings();
  const branding = resolveBranding(emp, settings);
  const format = (req.query.format as string) === "svg" ? "svg" : "png";
  const url = cardUrl(emp.public_id);
  res.setHeader("Cache-Control", "private, max-age=300");
  if (format === "svg") {
    const svg = await qrSvg(url);
    res.setHeader("Content-Type", "image/svg+xml");
    return res.send(svg);
  }
  const png = await qrPng(url, branding.logo_url);
  res.setHeader("Content-Type", "image/png");
  res.send(png);
});

publicRouter.get("/wallet-status", (_req, res) => {
  res.json({ apple: appleWalletConfigured, google: googleWalletConfigured });
});

publicRouter.get("/wallet/:publicId", browserOnly, requireToken("apple"), async (req, res) => {
  noIndex(res);
  noStore(res);
  if (!appleWalletConfigured) return res.status(501).send("Apple Wallet not configured");
  const emp = await loadActiveByPublicId(req.params.publicId);
  if (!emp) return res.status(404).send("Not found");
  try {
    const settings = await loadSettings();
    const branding = resolveBranding(emp, settings);
    const buf = await buildApplePass(emp, cardUrl(emp.public_id), branding);
    await insertEvent(emp.id, "wallet_download", req);
    res.setHeader("Content-Type", "application/vnd.apple.pkpass");
    res.setHeader("Content-Disposition", `attachment; filename="${emp.slug}.pkpass"`);
    res.send(buf);
  } catch (err: any) {
    console.error("[apple-wallet] build failed:", err?.message ?? err);
    res.status(500).send(`Apple Wallet pass generation failed: ${err?.message ?? "unknown error"}`);
  }
});

publicRouter.get("/google-wallet/:publicId", browserOnly, requireToken("google"), async (req, res) => {
  noIndex(res);
  noStore(res);
  if (!googleWalletConfigured) return res.status(501).send("Google Wallet not configured");
  const emp = await loadActiveByPublicId(req.params.publicId);
  if (!emp) return res.status(404).send("Not found");
  try {
    const settings = await loadSettings();
    const branding = resolveBranding(emp, settings);
    const url = buildGoogleWalletSaveUrl(emp, cardUrl(emp.public_id), branding);
    await insertEvent(emp.id, "wallet_download", req);
    res.redirect(302, url);
  } catch (err: any) {
    console.error("[google-wallet] build failed:", err?.message ?? err);
    res.status(500).send(`Google Wallet link generation failed: ${err?.message ?? "unknown error"}`);
  }
});
