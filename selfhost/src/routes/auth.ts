import { Router } from "express";
import bcrypt from "bcryptjs";
import QRCode from "qrcode";
import { z } from "zod";
import { query } from "../db.js";
import {
  clearSessionCookie,
  setSessionCookie,
  signSession,
  userIsAdmin,
  requireAuth,
} from "../auth.js";
import {
  clearMfaChallengeCookie,
  checkMfaRateLimit,
  clearMfaRateLimit,
  consumeRecoveryCode,
  generateAndStoreRecoveryCodes,
  generateTotpSecret,
  loadUserMfa,
  persistMfaSecret,
  readMfaChallenge,
  setMfaChallengeCookie,
  signMfaChallenge,
  totpKeyUri,
  verifyTotpCode,
} from "../lib/mfa.js";

export const authRouter = Router();

const LoginSchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(1).max(200),
});

// Step 1: password — issues only the MFA challenge cookie, never a session cookie
authRouter.post("/login", async (req, res) => {
  try {
    const parsed = LoginSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid credentials" });
    const { email, password } = parsed.data;

    const rows = await query<{
      id: string;
      email: string;
      password_hash: string;
      mfa_enrolled_at: string | null;
    }>(
      "SELECT id, email, password_hash, mfa_enrolled_at FROM users WHERE email = ? LIMIT 1",
      [email.toLowerCase()],
    );
    const u = rows[0];
    if (!u) return res.status(401).json({ error: "Invalid credentials" });
    const ok = await bcrypt.compare(password, u.password_hash);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });

    const enrolled = !!u.mfa_enrolled_at;
    const challenge = signMfaChallenge({
      uid: u.id,
      purpose: enrolled ? "login" : "enroll",
    });
    setMfaChallengeCookie(res, challenge);
    return res.json({ next: enrolled ? "verify" : "enroll" });
  } catch (err: any) {
    console.error("[auth/login] error:", err?.stack || err);
    return res.status(500).json({ error: "Login failed", detail: err?.message ?? String(err) });
  }
});

// Step 2a (first time): generate pending secret + QR
authRouter.post("/mfa/enroll/start", async (req, res) => {
  const ch = readMfaChallenge(req);
  if (!ch || ch.purpose !== "enroll") {
    return res.status(401).json({ error: "No active enrolment session" });
  }
  const rows = await query<{ email: string }>(`SELECT email FROM users WHERE id = ? LIMIT 1`, [
    ch.uid,
  ]);
  const user = rows[0];
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const secret = generateTotpSecret();
  const otpauthUrl = totpKeyUri(user.email, secret);
  const qrDataUrl = await QRCode.toDataURL(otpauthUrl, { margin: 1, width: 220 });

  const reissued = signMfaChallenge({ uid: ch.uid, purpose: "enroll", pendingSecret: secret });
  setMfaChallengeCookie(res, reissued);

  res.json({ otpauthUrl, secret, qrDataUrl });
});

// Step 2b (first time): verify code, persist secret, mint session, return recovery codes ONCE
authRouter.post("/mfa/enroll/confirm", async (req, res) => {
  const { code } = req.body ?? {};
  const ch = readMfaChallenge(req);
  if (!ch || ch.purpose !== "enroll" || !ch.pendingSecret) {
    return res.status(401).json({ error: "No active enrolment session" });
  }
  if (typeof code !== "string" || !verifyTotpCode(ch.pendingSecret, code)) {
    return res.status(400).json({ error: "Invalid code" });
  }

  await persistMfaSecret(ch.uid, ch.pendingSecret);
  const recoveryCodes = await generateAndStoreRecoveryCodes(ch.uid);

  const rows = await query<{ id: string; email: string }>(
    `SELECT id, email FROM users WHERE id = ? LIMIT 1`,
    [ch.uid],
  );
  const user = rows[0];
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const isAdmin = await userIsAdmin(user.id);
  clearMfaChallengeCookie(res);
  setSessionCookie(res, signSession({ sub: user.id, email: user.email, isAdmin }));
  clearMfaRateLimit(ch.uid);
  res.json({ recoveryCodes });
});

// Step 2 (returning user): accept TOTP or recovery code
authRouter.post("/mfa/verify", async (req, res) => {
  const { code } = req.body ?? {};
  const ch = readMfaChallenge(req);
  if (!ch || ch.purpose !== "login") {
    return res.status(401).json({ error: "No active sign-in" });
  }
  if (typeof code !== "string" || !code.trim()) {
    return res.status(400).json({ error: "Code required" });
  }
  if (!checkMfaRateLimit(ch.uid)) {
    return res.status(429).json({ error: "Too many attempts. Try again later." });
  }

  const { secret } = await loadUserMfa(ch.uid);
  if (!secret) return res.status(401).json({ error: "MFA not enrolled" });

  const cleaned = code.trim().replace(/\s+/g, "");
  let ok = /^\d{6}$/.test(cleaned) && verifyTotpCode(secret, cleaned);
  if (!ok) ok = await consumeRecoveryCode(ch.uid, code);
  if (!ok) return res.status(401).json({ error: "Invalid code" });

  const rows = await query<{ id: string; email: string }>(
    `SELECT id, email FROM users WHERE id = ? LIMIT 1`,
    [ch.uid],
  );
  const user = rows[0];
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const isAdmin = await userIsAdmin(user.id);
  clearMfaChallengeCookie(res);
  setSessionCookie(res, signSession({ sub: user.id, email: user.email, isAdmin }));
  clearMfaRateLimit(ch.uid);
  res.json({ ok: true });
});

// Authenticated: regenerate recovery codes after re-entering password
authRouter.post("/mfa/recovery/regenerate", requireAuth, async (req, res) => {
  const { password } = req.body ?? {};
  if (typeof password !== "string") return res.status(400).json({ error: "Password required" });
  const rows = await query<{ password_hash: string }>(
    `SELECT password_hash FROM users WHERE id = ? LIMIT 1`,
    [req.user!.sub],
  );
  const row = rows[0];
  if (!row || !(await bcrypt.compare(password, row.password_hash))) {
    return res.status(401).json({ error: "Invalid password" });
  }
  const recoveryCodes = await generateAndStoreRecoveryCodes(req.user!.sub);
  res.json({ recoveryCodes });
});

authRouter.post("/logout", (_req, res) => {
  clearSessionCookie(res);
  clearMfaChallengeCookie(res);
  res.json({ ok: true });
});

authRouter.get("/me", requireAuth, async (req, res) => {
  const rows = await query<{ mfa_enrolled_at: string | null }>(
    `SELECT mfa_enrolled_at FROM users WHERE id = ? LIMIT 1`,
    [req.user!.sub],
  );
  res.json({
    user: { id: req.user!.sub, email: req.user!.email, isAdmin: req.user!.isAdmin },
    mfaEnrolledAt: rows[0]?.mfa_enrolled_at ?? null,
  });
});
