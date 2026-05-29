/**
 * REST client for the self-hosted CardKit backend (Express + MySQL).
 *
 * Backend lives in /mnt/documents/selfhost/. Configure base URL via
 * `VITE_API_BASE_URL` — defaults to `/api`.
 *
 * Auth uses an httpOnly session cookie set by the backend on /api/auth/login,
 * so we send `credentials: 'include'` on every request. A 401 anywhere
 * triggers a soft client-side redirect to /login.
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

export type SessionUser = { id: string; email: string; isAdmin: boolean };

const RAW_BASE =
  (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_API_BASE_URL) ||
  "/api";

export const API_BASE = String(RAW_BASE).replace(/\/$/, "");

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function resolveUploadedUrl(url: string) {
  if (!url || /^https?:\/\//.test(url)) return url;
  if (typeof window === "undefined") return url;

  const base = /^https?:\/\//.test(API_BASE)
    ? new URL(API_BASE).origin
    : window.location.origin;

  return new URL(url, base).toString();
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
    ...init,
  });
  if (res.status === 401 && typeof window !== "undefined") {
    const here = window.location.pathname + window.location.search;
    if (!window.location.pathname.startsWith("/login")) {
      window.location.replace(`/login?redirect=${encodeURIComponent(here)}`);
    }
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new ApiError(
      res.status,
      `${init.method || "GET"} ${path} → ${res.status} ${res.statusText}${body ? `: ${body}` : ""}`,
    );
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  // --------- Auth ---------
  login: (email: string, password: string) =>
    request<{ ok: true }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  logout: () => request<{ ok: true }>("/auth/logout", { method: "POST" }),
  me: () => request<{ user: SessionUser }>("/auth/me"),

  // --------- Employees ---------
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

  // --------- Settings ---------
  getSettings: () => request<{ settings: CompanySettings }>("/settings"),
  updateSettings: (values: Partial<CompanySettings>) =>
    request<{ settings: CompanySettings }>("/settings", {
      method: "PATCH",
      body: JSON.stringify(values),
    }),

  // --------- Uploads ---------
  uploadFile: async (file: File, kind: "employee-photo" | "company-asset") => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("kind", kind);
    const res = await fetch(`${API_BASE}/uploads`, {
      method: "POST",
      credentials: "include",
      body: fd,
    });
    if (res.status === 401 && typeof window !== "undefined") {
      window.location.replace("/login");
    }
    if (!res.ok) throw new ApiError(res.status, `Upload failed: ${res.status}`);
    const uploaded = (await res.json()) as { url: string };
    return { url: resolveUploadedUrl(uploaded.url) };
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
