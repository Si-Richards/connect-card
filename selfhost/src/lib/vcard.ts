import type { Employee } from "../routes/types.js";

function esc(v: string): string {
  return v.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

export function buildVCard(e: Employee): string {
  const lines: string[] = ["BEGIN:VCARD", "VERSION:3.0"];
  lines.push(`FN:${esc(e.full_name)}`);
  const parts = e.full_name.trim().split(/\s+/);
  const last = parts.length > 1 ? parts.pop()! : "";
  const first = parts.join(" ");
  lines.push(`N:${esc(last)};${esc(first)};;;`);
  if (e.company) lines.push(`ORG:${esc(e.company)}`);
  if (e.job_title) lines.push(`TITLE:${esc(e.job_title)}`);
  if (e.email) lines.push(`EMAIL;TYPE=INTERNET:${esc(e.email)}`);
  if (e.office_phone) lines.push(`TEL;TYPE=WORK,VOICE:${esc(e.office_phone)}`);
  if (e.mobile) lines.push(`TEL;TYPE=CELL,VOICE:${esc(e.mobile)}`);
  if (e.website) lines.push(`URL:${esc(e.website)}`);
  if (e.linkedin) lines.push(`URL;TYPE=LinkedIn:${esc(e.linkedin)}`);
  if (e.booking_url) lines.push(`URL;TYPE=Booking:${esc(e.booking_url)}`);
  if (e.address) lines.push(`ADR;TYPE=WORK:;;${esc(e.address)};;;;`);
  if (e.notes) lines.push(`NOTE:${esc(e.notes)}`);
  lines.push("END:VCARD");
  return lines.join("\r\n") + "\r\n";
}
