import crypto from "node:crypto";
import { v4 as uuid } from "uuid";
import type { Request } from "express";
import { exec } from "../db.js";
import { env } from "../env.js";

export type EventType =
  | "view"
  | "qr_scan"
  | "vcard_download"
  | "wallet_download"
  | "booking_click";

function hashIp(req: Request): string | null {
  const ip =
    (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ||
    req.socket.remoteAddress ||
    "";
  if (!ip) return null;
  return crypto.createHmac("sha256", env.SESSION_SECRET).update(ip).digest("hex");
}

export async function insertEvent(
  employeeId: string,
  type: EventType,
  req: Request,
): Promise<void> {
  await exec(
    `INSERT INTO card_events (id, employee_id, event_type, user_agent, referrer, ip_hash)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      uuid(),
      employeeId,
      type,
      (req.headers["user-agent"] as string | undefined)?.slice(0, 500) ?? null,
      (req.headers["referer"] as string | undefined)?.slice(0, 500) ?? null,
      hashIp(req),
    ],
  );
  if (type === "view") {
    await exec("UPDATE employees SET view_count = view_count + 1 WHERE id = ?", [employeeId]);
  }
}
