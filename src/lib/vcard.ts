export type EmployeeCard = {
  full_name: string;
  job_title?: string | null;
  company?: string | null;
  email?: string | null;
  office_phone?: string | null;
  mobile?: string | null;
  website?: string | null;
  linkedin?: string | null;
  notes?: string | null;
  photo_url?: string | null;
};

function esc(v: string) {
  return v.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

export function buildVCard(e: EmployeeCard): string {
  const parts: string[] = ["BEGIN:VCARD", "VERSION:3.0"];
  parts.push(`FN:${esc(e.full_name)}`);
  const names = e.full_name.trim().split(/\s+/);
  const last = names.length > 1 ? names.pop()! : "";
  const first = names.join(" ");
  parts.push(`N:${esc(last)};${esc(first)};;;`);
  if (e.company) parts.push(`ORG:${esc(e.company)}`);
  if (e.job_title) parts.push(`TITLE:${esc(e.job_title)}`);
  if (e.email) parts.push(`EMAIL;TYPE=WORK:${esc(e.email)}`);
  if (e.office_phone) parts.push(`TEL;TYPE=WORK,VOICE:${esc(e.office_phone)}`);
  if (e.mobile) parts.push(`TEL;TYPE=CELL,VOICE:${esc(e.mobile)}`);
  if (e.website) parts.push(`URL:${esc(e.website)}`);
  if (e.linkedin) parts.push(`X-SOCIALPROFILE;TYPE=linkedin:${esc(e.linkedin)}`);
  if (e.notes) parts.push(`NOTE:${esc(e.notes)}`);
  if (e.photo_url) parts.push(`PHOTO;VALUE=URI:${e.photo_url}`);
  parts.push("END:VCARD");
  return parts.join("\r\n");
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}
