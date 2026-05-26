export type Employee = {
  id: string;
  slug: string;
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
  disabled: number | boolean;
  view_count: number;
  created_at: string;
  updated_at: string;
};

export type CompanySettings = {
  company_name: string | null;
  brand_color: string | null;
  logo_url: string | null;
};
