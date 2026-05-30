import crypto from "node:crypto";
import { env } from "../env.js";

export type ResourceKind = "vcard" | "apple" | "google";

function compute(slug: string, kind: ResourceKind, exp: number): string {
  return crypto
    .createHmac("sha256", env.SESSION_SECRET)
    .update(`${kind}:${slug}:${exp}`)
    .digest("base64url")
    .slice(0, 32);
}

export function signResource(
  slug: string,
  kind: ResourceKind,
  ttlSec = 600,
): { exp: number; sig: string } {
  const exp = Math.floor(Date.now() / 1000) + ttlSec;
  return { exp, sig: compute(slug, kind, exp) };
}

export function verifyResource(
  slug: string,
  kind: ResourceKind,
  exp: number | string | undefined,
  sig: string | undefined,
): boolean {
  if (!sig || !exp) return false;
  const expNum = typeof exp === "string" ? Number(exp) : exp;
  if (!Number.isFinite(expNum)) return false;
  if (expNum < Math.floor(Date.now() / 1000)) return false;
  const expected = compute(slug, kind, expNum);
  const a = Buffer.from(expected);
  const b = Buffer.from(sig);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
