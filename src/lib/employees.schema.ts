import { z } from "zod";

// Accept empty string, /uploads/... path, absolute http(s) URL, or a domain
// that will be normalized at save time.
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
  disabled: z.boolean().optional().default(false),
});

export type EmployeeInput = z.infer<typeof employeeInputSchema>;
