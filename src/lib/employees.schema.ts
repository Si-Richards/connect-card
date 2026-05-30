import { z } from "zod";

const optionalUrl = (field: string) =>
  z
    .string()
    .trim()
    .max(512)
    .refine(
      (v) =>
        v === "" ||
        v.startsWith("/uploads/") ||
        /^https?:\/\/\S+$/i.test(v) ||
        /^[\w.-]+\.[a-z]{2,}(?:\/\S*)?$/i.test(v),
      `${field} must be a valid URL`,
    )
    .optional()
    .or(z.literal(""))
    .nullable();

const optionalHex = z
  .string()
  .trim()
  .max(16)
  .refine((v) => v === "" || /^#[0-9a-fA-F]{3,8}$/.test(v), "Must be a hex color like #ff6600")
  .optional()
  .or(z.literal(""))
  .nullable();

export const employeeInputSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(1, "Slug is required")
    .max(64)
    .regex(/^[a-z0-9-]+$/, "Slug: lowercase letters, numbers, hyphens only"),
  full_name: z.string().trim().min(1, "Full name is required").max(120),
  job_title: z.string().trim().max(120).optional().or(z.literal("")),
  company: z.string().trim().max(120).optional().or(z.literal("")),
  email: z
    .string()
    .trim()
    .max(255)
    .refine((v) => v === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "Invalid email address")
    .optional()
    .or(z.literal("")),
  office_phone: z.string().trim().max(40).optional().or(z.literal("")),
  mobile: z.string().trim().max(40).optional().or(z.literal("")),
  website: optionalUrl("Website"),
  linkedin: optionalUrl("LinkedIn URL"),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
  photo_url: optionalUrl("Photo URL"),
  address: z.string().trim().max(500).optional().or(z.literal("")).nullable(),
  brand_color: optionalHex,
  accent_color: optionalHex,
  logo_url: optionalUrl("Logo URL"),
  cover_image_url: optionalUrl("Cover image URL"),
  booking_url: optionalUrl("Booking link"),
  disabled: z.boolean().optional().default(false),
});

export type EmployeeInput = z.infer<typeof employeeInputSchema>;
