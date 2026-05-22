/**
 * REST client for the self-hosted CardKit backend (Express + MySQL).
 *
 * The backend lives in /mnt/documents/selfhost/ in this repo's deliverables.
 * Configure the base URL with `VITE_API_BASE_URL` — defaults to `/api`,
 * which works when the same origin reverse-proxies `/api/*` to the backend.
 *
 * No auth is attached. Re-introduce a token attacher here if/when you want
 * to gate the admin endpoints again.
 */

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
  disabled: boolean;
  view_count: number;
  created_at: string;
  updated_at: string;
};

export type CompanySettings = {
  company_name: string | null;
  brand_color: string | null;
  logo_url: string | null;
};

export type EventBucket = {
  views: number;
  scans: number;
  vcards: number;
  wallets: number;
};

export type AnalyticsTotals = Record<string, EventBucket>;

export type AnalyticsSeriesPoint = { date: string } & EventBucket;

export type AnalyticsEvent = {
  event_type: "view" | "qr_scan" | "vcard_download" | "wallet_download";
  occurred_at: string;
  user_agent: string | null;
  referrer: string | null;
};

export type AnalyticsSummary = {
  since: string;
  days: number;
  totals: AnalyticsTotals;
  series: AnalyticsSeriesPoint[];
};

export type AnalyticsDetail = {
  employee: { id: string; full_name: string; slug: string };
  since: string;
  days: number;
  totals: EventBucket;
  series: AnalyticsSeriesPoint[];
  recent: AnalyticsEvent[];
};

const RAW_BASE =
  (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_API_BASE_URL) ||
  "/api";

export const API_BASE = String(RAW_BASE).replace(/\/$/, "");

async function request<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
    ...init,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `${init.method || "GET"} ${path} → ${res.status} ${res.statusText}${body ? `: ${body}` : ""}`,
    );
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

// --------- Employees ---------

export const api = {
  listEmployees: () => request<{ employees: Employee[] }>("/employees"),

  getEmployee: (id: string) => request<{ employee: Employee }>(`/employees/${id}`),

  getEmployeeBySlug: (slug: string) =>
    request<{ employee: Employee | null; settings: CompanySettings | null }>(
      `/public/cards/${encodeURIComponent(slug)}`,
    ),

  createEmployee: (values: Partial<Employee>) =>
    request<{ employee: Employee }>("/employees", {
      method: "POST",
      body: JSON.stringify(values),
    }),

  updateEmployee: (id: string, values: Partial<Employee>) =>
    request<{ employee: Employee }>(`/employees/${id}`, {
      method: "PATCH",
      body: JSON.stringify(values),
    }),

  deleteEmployee: (id: string) =>
    request<{ ok: true }>(`/employees/${id}`, { method: "DELETE" }),

  toggleEmployeeDisabled: (id: string, disabled: boolean) =>
    request<{ ok: true }>(`/employees/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ disabled }),
    }),

  getSettings: () => request<{ settings: CompanySettings }>("/settings"),

  updateSettings: (values: Partial<CompanySettings>) =>
    request<{ settings: CompanySettings }>("/settings", {
      method: "PATCH",
      body: JSON.stringify(values),
    }),

  // --------- Uploads (local disk on the backend) ---------

  uploadFile: async (file: File, kind: "employee-photo" | "company-asset") => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("kind", kind);
    const res = await fetch(`${API_BASE}/uploads`, { method: "POST", body: fd });
    if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
    return (await res.json()) as { url: string };
  },

  // --------- Analytics ---------

  recordEvent: (input: {
    slug: string;
    eventType: "view" | "scan";
    source?: string | null;
    userAgent?: string | null;
    referrer?: string | null;
  }) =>
    request<{ ok: boolean }>("/public/events", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  listAnalytics: (days = 30) =>
    request<AnalyticsSummary>(`/analytics/summary?days=${days}`),

  getAnalytics: (id: string, days = 30) =>
    request<AnalyticsDetail>(`/analytics/employees/${id}?days=${days}`),
};
