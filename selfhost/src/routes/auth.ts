import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { query } from "../db.js";
import {
  clearSessionCookie,
  setSessionCookie,
  signSession,
  userIsAdmin,
  requireAuth,
} from "../auth.js";

export const authRouter = Router();

const LoginSchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(1).max(200),
});

authRouter.post("/login", async (req, res) => {
  try {
    const parsed = LoginSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid credentials" });
    const { email, password } = parsed.data;

    const rows = await query<{ id: string; email: string; password_hash: string }>(
      "SELECT id, email, password_hash FROM users WHERE email = ? LIMIT 1",
      [email.toLowerCase()],
    );
    const u = rows[0];
    if (!u) return res.status(401).json({ error: "Invalid credentials" });
    const ok = await bcrypt.compare(password, u.password_hash);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });

    const isAdmin = await userIsAdmin(u.id);
    const token = signSession({ sub: u.id, email: u.email, isAdmin });
    setSessionCookie(res, token);
    return res.json({ ok: true });
  } catch (err: any) {
    console.error("[auth/login] error:", err?.stack || err);
    return res.status(500).json({ error: "Login failed", detail: err?.message ?? String(err) });
  }
});

authRouter.post("/logout", (_req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});

authRouter.get("/me", requireAuth, (req, res) => {
  res.json({
    user: { id: req.user!.sub, email: req.user!.email, isAdmin: req.user!.isAdmin },
  });
});
