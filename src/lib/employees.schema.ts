import { z } from "zod";

export const employeeInputSchema = z.object({
  slug: z.string().trim().min(1).max(64).regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers, hyphens only"),
  full_name: z.string().trim().min(1).max(120),
  job_title: z.string().trim().max(120).optional().or(z.literal("")),
  company: z.string().trim().max(120).optional().or(z.literal("")),
  email: z.string().trim().email().max(255).optional().or(z.literal("")),
  office_phone: z.string().trim().max(40).optional().or(z.literal("")),
  mobile: z.string().trim().max(40).optional().or(z.literal("")),
  website: z.string().trim().url().max(255).optional().or(z.literal("")),
  linkedin: z.string().trim().url().max(255).optional().or(z.literal("")),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
  photo_url: z
    .string()
    .trim()
    .max(500)
    .refine(
      (v) => v === "" || v.startsWith("/uploads/") || /^https?:\/\//.test(v),
      "Must be an uploaded file or a full URL",
    )
    .optional()
    .or(z.literal(""))
    .nullable(),
  disabled: z.boolean().optional().default(false),
});

export type EmployeeInput = z.infer<typeof employeeInputSchema>;
