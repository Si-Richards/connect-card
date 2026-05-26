import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "./env.js";
import { query } from "./db.js";

const COOKIE_NAME = "session";
const TOKEN_TTL = "7d";

export type SessionClaims = { sub: string; email: string; isAdmin: boolean };

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: SessionClaims;
    }
  }
}

export function signSession(claims: SessionClaims): string {
  return jwt.sign(claims, env.SESSION_SECRET, { expiresIn: TOKEN_TTL });
}

export function setSessionCookie(res: Response, token: string) {
  const secure = env.APP_ORIGIN.startsWith("https://");
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(COOKIE_NAME, { path: "/" });
}

function readSession(req: Request): SessionClaims | null {
  const tok = req.cookies?.[COOKIE_NAME];
  if (!tok) return null;
  try {
    return jwt.verify(tok, env.SESSION_SECRET) as SessionClaims;
  } catch {
    return null;
  }
}

export function attachUser(req: Request, _res: Response, next: NextFunction) {
  const s = readSession(req);
  if (s) req.user = s;
  next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).send("Unauthorized");
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).send("Unauthorized");
  if (!req.user.isAdmin) return res.status(403).send("Forbidden");
  next();
}

export async function userIsAdmin(userId: string): Promise<boolean> {
  const rows = await query<{ c: number }>(
    "SELECT COUNT(*) AS c FROM user_roles WHERE user_id = ? AND role = 'admin'",
    [userId],
  );
  return (rows[0]?.c ?? 0) > 0;
}
