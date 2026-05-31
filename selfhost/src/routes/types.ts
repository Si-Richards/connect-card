export type Employee = {
  id: string;
  slug: string;
  public_id: string;
  full_name: string;
  job_title: string | null;
  company: string | null;
  email: string | null;
  office_phone: string | null;
  mobile: string | null;
  website: string | null;
  linkedin: string | null;
  notes: string | null;
  photo_url: string | null;
  address: string | null;
  brand_color: string | null;
  accent_color: string | null;
  logo_url: string | null;
  cover_image_url: string | null;
  booking_url: string | null;
  disabled: number | boolean;
  view_count: number;
  created_at: string;
  updated_at: string;
};

export type CompanySettings = {
  company_name: string | null;
  brand_color: string | null;
  accent_color: string | null;
  logo_url: string | null;
  cover_image_url: string | null;
};

export type Branding = {
  company_name: string | null;
  brand_color: string | null;
  accent_color: string | null;
  logo_url: string | null;
  cover_image_url: string | null;
};

export function resolveBranding(
  emp: Pick<Employee, "company" | "brand_color" | "accent_color" | "logo_url" | "cover_image_url">,
  settings: CompanySettings | null,
): Branding {
  return {
    company_name: emp.company ?? settings?.company_name ?? null,
    brand_color: emp.brand_color ?? settings?.brand_color ?? null,
    accent_color: emp.accent_color ?? settings?.accent_color ?? null,
    logo_url: emp.logo_url ?? settings?.logo_url ?? null,
    cover_image_url: emp.cover_image_url ?? settings?.cover_image_url ?? null,
  };
}
