import { Router } from "express";
import { z } from "zod";
import { v4 as uuid } from "uuid";
import crypto from "node:crypto";
import { exec, query } from "../db.js";
import { requireAdmin } from "../auth.js";
import type { Employee } from "./types.js";

export const employeesRouter = Router();
employeesRouter.use(requireAdmin);

function randomizeSlug(slug: string): string {
  if (/-[a-z0-9]{6,}$/.test(slug)) return slug;
  const suffix = crypto
    .randomBytes(6)
    .toString("base64url")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 6)
    .padEnd(6, "0");
  return `${slug}-${suffix}`;
}

const hex = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{3,8}$/)
  .nullable()
  .optional();

const EmployeeSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(1)
    .max(255)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, numbers, hyphens"),
  full_name: z.string().trim().min(1).max(255),
  job_title: z.string().trim().max(255).nullable().optional(),
  company: z.string().trim().max(255).nullable().optional(),
  email: z.string().trim().email().max(255).nullable().optional().or(z.literal("").transform(() => null)),
  office_phone: z.string().trim().max(64).nullable().optional(),
  mobile: z.string().trim().max(64).nullable().optional(),
  website: z.string().trim().max(512).nullable().optional(),
  linkedin: z.string().trim().max(512).nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
  photo_url: z.string().max(512).nullable().optional(),
  address: z.string().trim().max(500).nullable().optional(),
  brand_color: hex,
  accent_color: hex,
  logo_url: z.string().trim().max(512).nullable().optional(),
  cover_image_url: z.string().trim().max(512).nullable().optional(),
  booking_url: z.string().trim().max(512).nullable().optional(),
  disabled: z.boolean().optional(),
});

const FIELDS = `id, slug, public_id, full_name, job_title, company, email, office_phone, mobile,
  website, linkedin, notes, photo_url, address,
  brand_color, accent_color, logo_url, cover_image_url, booking_url,
  disabled, view_count, created_at, updated_at`;

function newPublicId(): string {
  // 16 random bytes → 22-char url-safe lowercase string. Unguessable.
  return crypto
    .randomBytes(16)
    .toString("base64url")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 22);
}

function normalize(e: Employee): Employee {
  return { ...e, disabled: !!e.disabled };
}

employeesRouter.get("/", async (_req, res) => {
  const rows = await query<Employee>(
    `SELECT ${FIELDS} FROM employees ORDER BY created_at DESC`,
  );
  res.json({ employees: rows.map(normalize) });
});

employeesRouter.get("/:id", async (req, res) => {
  const rows = await query<Employee>(`SELECT ${FIELDS} FROM employees WHERE id = ?`, [
    req.params.id,
  ]);
  if (!rows[0]) return res.status(404).json({ error: "Not found" });
  res.json({ employee: normalize(rows[0]) });
});

employeesRouter.post("/", async (req, res) => {
  const parsed = EmployeeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
  const v = parsed.data;
  const id = uuid();
  try {
    await exec(
      `INSERT INTO employees
       (id, slug, public_id, full_name, job_title, company, email, office_phone, mobile,
        website, linkedin, notes, photo_url, address,
        brand_color, accent_color, logo_url, cover_image_url, booking_url,
        disabled, created_by)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        id,
        randomizeSlug(v.slug),
        newPublicId(),
        v.full_name,
        v.job_title ?? null,
        v.company ?? null,
        v.email ?? null,
        v.office_phone ?? null,
        v.mobile ?? null,
        v.website ?? null,
        v.linkedin ?? null,
        v.notes ?? null,
        v.photo_url ?? null,
        v.address ?? null,
        v.brand_color ?? null,
        v.accent_color ?? null,
        v.logo_url ?? null,
        v.cover_image_url ?? null,
        v.booking_url ?? null,
        v.disabled ? 1 : 0,
        req.user!.sub,
      ],
    );
  } catch (err: any) {
    if (err?.code === "ER_DUP_ENTRY")
      return res.status(409).json({ error: "Slug already exists" });
    throw err;
  }
  const rows = await query<Employee>(`SELECT ${FIELDS} FROM employees WHERE id = ?`, [id]);
  res.status(201).json({ employee: normalize(rows[0]) });
});

employeesRouter.patch("/:id", async (req, res) => {
  const parsed = EmployeeSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
  const v = parsed.data;
  const sets: string[] = [];
  const params: any[] = [];
  for (const [k, val] of Object.entries(v)) {
    sets.push(`${k} = ?`);
    params.push(k === "disabled" ? (val ? 1 : 0) : val);
  }
  if (sets.length === 0) return res.json({ employee: null });
  params.push(req.params.id);
  try {
    await exec(`UPDATE employees SET ${sets.join(", ")} WHERE id = ?`, params);
  } catch (err: any) {
    if (err?.code === "ER_DUP_ENTRY")
      return res.status(409).json({ error: "Slug already exists" });
    throw err;
  }
  const rows = await query<Employee>(`SELECT ${FIELDS} FROM employees WHERE id = ?`, [
    req.params.id,
  ]);
  if (!rows[0]) return res.status(404).json({ error: "Not found" });
  res.json({ employee: normalize(rows[0]) });
});

employeesRouter.delete("/:id", async (req, res) => {
  await exec("DELETE FROM employees WHERE id = ?", [req.params.id]);
  res.json({ ok: true });
});
