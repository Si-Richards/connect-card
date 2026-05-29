import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";

import { useEffect, useState } from "react";
import { ArrowLeft, Upload } from "lucide-react";
import { upsertEmployee, getEmployee } from "@/lib/employees.functions";
import { employeeInputSchema } from "@/lib/employees.schema";
import { api } from "@/lib/api";

function slugify(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

type Mode = { kind: "new" } | { kind: "edit"; id: string };

export function EmployeeForm({ mode }: { mode: Mode }) {
  const nav = useNavigate();
  const upsert = upsertEmployee;
  const fetchOne = getEmployee;

  const [form, setForm] = useState<any>({
    slug: "", full_name: "", job_title: "", company: "", email: "",
    office_phone: "", mobile: "", website: "", linkedin: "", notes: "",
    photo_url: "", disabled: false,
  });
  const [slugTouched, setSlugTouched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (mode.kind === "edit") {
      fetchOne({ data: { id: mode.id } }).then((r) => {
        if (r.employee) {
          setForm({ ...r.employee, photo_url: r.employee.photo_url ?? "" });
          setSlugTouched(true);
        }
      });
    }
  }, [mode.kind === "edit" ? mode.id : null]);

  const update = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const onNameChange = (v: string) => {
    update("full_name", v);
    if (!slugTouched && mode.kind === "new") update("slug", slugify(v));
  };

  const onUpload = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const { url } = await api.uploadFile(file, "employee-photo");
      update("photo_url", url);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  };

  // If a photo_url got saved as an absolute same-origin /uploads URL by an
  // older build, collapse it back to a relative path so validation passes.
  const normalizePhotoUrl = (v: string) => {
    const trimmed = (v ?? "").trim();
    if (!trimmed) return "";
    if (trimmed.startsWith("uploads/")) return `/${trimmed}`;
    if (typeof window !== "undefined") {
      try {
        const u = new URL(trimmed, window.location.origin);
        if (u.origin === window.location.origin && u.pathname.startsWith("/uploads/")) {
          return u.pathname;
        }
      } catch { /* not a parseable URL — leave it */ }
    }
    return trimmed;
  };

  const normalizeExternalUrl = (v: string | null | undefined) => {
    const trimmed = (v ?? "").trim();
    if (!trimmed || trimmed.startsWith("/uploads/") || /^https?:\/\//i.test(trimmed)) return trimmed;
    return `https://${trimmed}`;
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const candidate = {
      ...form,
      website: normalizeExternalUrl(form.website),
      linkedin: normalizeExternalUrl(form.linkedin),
      photo_url: normalizePhotoUrl(form.photo_url ?? ""),
    };
    const parsed = employeeInputSchema.safeParse(candidate);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const field = issue?.path?.join(".") ?? "";
      setError(field ? `${field}: ${issue.message}` : (issue?.message ?? "Invalid input"));
      return;
    }
    setLoading(true);
    try {
      await upsert({
        data: {
          id: mode.kind === "edit" ? mode.id : undefined,
          values: parsed.data,
        },
      });
      nav({ to: "/admin" });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <Link to="/admin" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="w-4 h-4" /> Back
      </Link>
      <h1 className="text-2xl font-semibold mt-2">
        {mode.kind === "new" ? "New employee" : "Edit employee"}
      </h1>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-full bg-muted overflow-hidden flex items-center justify-center text-muted-foreground">
            {form.photo_url ? <img src={form.photo_url} className="w-full h-full object-cover" alt="" /> : "Photo"}
          </div>
          <label className="inline-flex items-center gap-2 text-sm rounded-md border border-input px-3 py-2 cursor-pointer hover:bg-muted">
            <Upload className="w-4 h-4" />
            {uploading ? "Uploading…" : "Upload photo"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])}
            />
          </label>
        </div>

        <Field label="Full name" required value={form.full_name} onChange={onNameChange} />
        <Field
          label="URL slug"
          required value={form.slug}
          onChange={(v) => { setSlugTouched(true); update("slug", v); }}
          hint="lowercase letters, numbers, hyphens"
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Job title" value={form.job_title} onChange={(v) => update("job_title", v)} />
          <Field label="Company" value={form.company} onChange={(v) => update("company", v)} />
          <Field label="Email" type="email" value={form.email} onChange={(v) => update("email", v)} />
          <Field label="Office phone" value={form.office_phone} onChange={(v) => update("office_phone", v)} />
          <Field label="Mobile" value={form.mobile} onChange={(v) => update("mobile", v)} />
          <Field label="Website" type="url" placeholder="https://" value={form.website} onChange={(v) => update("website", v)} />
          <Field label="LinkedIn URL" type="url" placeholder="https://" value={form.linkedin} onChange={(v) => update("linkedin", v)} />
        </div>
        <div>
          <label className="text-sm font-medium">Notes (shown in vCard)</label>
          <textarea
            value={form.notes}
            onChange={(e) => update("notes", e.target.value)}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            rows={3}
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.disabled}
            onChange={(e) => update("disabled", e.target.checked)}
          />
          Card disabled (hide from public)
        </label>

        {error && <div className="text-sm text-destructive">{error}</div>}

        <div className="flex gap-2">
          <button
            disabled={loading}
            className="rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-60"
          >
            {loading ? "Saving…" : "Save"}
          </button>
          <Link to="/admin" className="rounded-md border border-input px-4 py-2 text-sm">Cancel</Link>
        </div>
      </form>
    </div>
  );
}

function Field({
  label, value, onChange, type = "text", required, placeholder, hint,
}: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; required?: boolean; placeholder?: string; hint?: string;
}) {
  return (
    <div>
      <label className="text-sm font-medium">{label}{required && " *"}</label>
      <input
        type={type}
        required={required}
        placeholder={placeholder}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
      />
      {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/admin/new")({
  component: () => <EmployeeForm mode={{ kind: "new" }} />,
});
