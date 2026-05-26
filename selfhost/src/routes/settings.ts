import { Router } from "express";
import { z } from "zod";
import { exec, query } from "../db.js";
import { requireAdmin } from "../auth.js";
import type { CompanySettings } from "./types.js";

export const settingsRouter = Router();
settingsRouter.use(requireAdmin);

const SettingsSchema = z.object({
  company_name: z.string().trim().max(255).nullable().optional(),
  brand_color: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{3,8}$/)
    .nullable()
    .optional(),
  logo_url: z.string().trim().max(512).nullable().optional(),
});

settingsRouter.get("/", async (_req, res) => {
  const rows = await query<CompanySettings>(
    "SELECT company_name, brand_color, logo_url FROM company_settings WHERE id = 1",
  );
  res.json({ settings: rows[0] ?? { company_name: null, brand_color: null, logo_url: null } });
});

settingsRouter.patch("/", async (req, res) => {
  const parsed = SettingsSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
  const v = parsed.data;
  const sets: string[] = [];
  const params: any[] = [];
  for (const [k, val] of Object.entries(v)) {
    sets.push(`${k} = ?`);
    params.push(val);
  }
  if (sets.length) {
    await exec(`UPDATE company_settings SET ${sets.join(", ")} WHERE id = 1`, params);
  }
  const rows = await query<CompanySettings>(
    "SELECT company_name, brand_color, logo_url FROM company_settings WHERE id = 1",
  );
  res.json({ settings: rows[0] });
});
