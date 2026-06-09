import crypto from "crypto";
import { authenticator } from "otplib";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { Request, Response } from "express";
import { query, exec } from "../db.js";
import { env } from "../env.js";

const ISSUER = process.env.MFA_ISSUER || "CardKit Admin";
const MFA_COOKIE = "bc_mfa";
const MFA_TTL_S = 60 * 5; // 5 minutes

// TOTP: 1-step window (~30s before/after) to absorb clock drift
authenticator.options = { window: 1, step: 30, digits: 6 };

// ---------- AES-256-GCM secret-at-rest ----------
function aesKey(): Buffer {
  return crypto.hkdfSync(
    "sha256",
    env.SESSION_SECRET,
    Buffer.alloc(0),
    Buffer.from("bc-mfa-enc"),
    32,
  ) as Buffer;
}

export function encryptSecret(plain: string): Buffer {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", aesKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]);
}

export function decryptSecret(buf: Buffer): string {
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const ct = buf.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", aesKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}

// ---------- TOTP ----------
export function generateTotpSecret(): string {
  return authenticator.generateSecret();
}

export function totpKeyUri(email: string, secret: string): string {
  return authenticator.keyuri(email, ISSUER, secret);
}

export function verifyTotpCode(secret: string, code: string): boolean {
  const cleaned = code.replace(/\s+/g, "");
  if (!/^\d{6}$/.test(cleaned)) return false;
  try {
    return authenticator.verify({ token: cleaned, secret });
  } catch {
    return false;
  }
}

// ---------- MFA challenge cookie ----------
export type MfaChallengePayload = {
  uid: string;
  purpose: "login" | "enroll";
  pendingSecret?: string;
};

export function signMfaChallenge(payload: MfaChallengePayload): string {
  return jwt.sign(payload, env.SESSION_SECRET, { expiresIn: MFA_TTL_S });
}

export function setMfaChallengeCookie(res: Response, token: string) {
  const secure = env.APP_ORIGIN.startsWith("https://");
  res.cookie(MFA_COOKIE, token, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    maxAge: MFA_TTL_S * 1000,
    path: "/",
  });
}

export function clearMfaChallengeCookie(res: Response) {
  res.clearCookie(MFA_COOKIE, { path: "/" });
}

export function readMfaChallenge(req: Request): MfaChallengePayload | null {
  const token = (req as Request & { cookies?: Record<string, string> }).cookies?.[MFA_COOKIE];
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, env.SESSION_SECRET) as jwt.JwtPayload & MfaChallengePayload;
    if (decoded.purpose !== "login" && decoded.purpose !== "enroll") return null;
    return {
      uid: String(decoded.uid),
      purpose: decoded.purpose,
      pendingSecret: decoded.pendingSecret,
    };
  } catch {
    return null;
  }
}

// ---------- Recovery codes ----------
function randomCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.randomBytes(8);
  let out = "";
  for (let i = 0; i < 8; i++) out += alphabet[bytes[i] % alphabet.length];
  return out.slice(0, 4) + "-" + out.slice(4);
}

export async function generateAndStoreRecoveryCodes(userId: string): Promise<string[]> {
  await exec(`DELETE FROM user_mfa_recovery_codes WHERE user_id = ?`, [userId]);
  const codes: string[] = [];
  for (let i = 0; i < 10; i++) codes.push(randomCode());
  for (const c of codes) {
    const hash = await bcrypt.hash(c, 10);
    await exec(
      `INSERT INTO user_mfa_recovery_codes (id, user_id, code_hash) VALUES (UUID(), ?, ?)`,
      [userId, hash],
    );
  }
  return codes;
}

export async function consumeRecoveryCode(userId: string, code: string): Promise<boolean> {
  const cleaned = code.trim().toUpperCase().replace(/\s+/g, "");
  if (!cleaned) return false;
  const rows = await query<{ id: string; code_hash: string }>(
    `SELECT id, code_hash FROM user_mfa_recovery_codes WHERE user_id = ? AND used_at IS NULL`,
    [userId],
  );
  for (const row of rows) {
    if (await bcrypt.compare(cleaned, row.code_hash)) {
      await exec(`UPDATE user_mfa_recovery_codes SET used_at = NOW() WHERE id = ?`, [row.id]);
      return true;
    }
  }
  return false;
}

// ---------- DB helpers ----------
export async function loadUserMfa(
  userId: string,
): Promise<{ secret: string | null; enrolledAt: string | null }> {
  const rows = await query<{ mfa_secret_enc: Buffer | null; mfa_enrolled_at: string | null }>(
    `SELECT mfa_secret_enc, mfa_enrolled_at FROM users WHERE id = ?`,
    [userId],
  );
  const row = rows[0];
  if (!row) return { secret: null, enrolledAt: null };
  return {
    secret: row.mfa_secret_enc ? decryptSecret(row.mfa_secret_enc) : null,
    enrolledAt: row.mfa_enrolled_at,
  };
}

export async function persistMfaSecret(userId: string, secret: string): Promise<void> {
  await exec(
    `UPDATE users SET mfa_secret_enc = ?, mfa_enrolled_at = NOW() WHERE id = ?`,
    [encryptSecret(secret), userId],
  );
}

// ---------- In-memory rate limiter ----------
const attempts = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

export function checkMfaRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = attempts.get(userId);
  if (!entry || entry.resetAt < now) {
    attempts.set(userId, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (entry.count >= MAX_ATTEMPTS) return false;
  entry.count += 1;
  return true;
}

export function clearMfaRateLimit(userId: string): void {
  attempts.delete(userId);
}
