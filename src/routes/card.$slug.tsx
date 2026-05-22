import { createFileRoute, notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { Mail, Phone, Smartphone, Globe, Linkedin, Download, QrCode, Wallet } from "lucide-react";
import { useEffect, useState } from "react";
import { recordEmployeeEvent } from "@/lib/analytics.functions";

const getPublicCard = createServerFn({ method: "POST" })
  .inputValidator((input: { slug: string }) =>
    z.object({ slug: z.string().min(1).max(64) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: employee, error } = await supabaseAdmin
      .from("employees")
      .select(
        "id, slug, full_name, job_title, company, email, office_phone, mobile, website, linkedin, notes, photo_url, disabled",
      )
      .eq("slug", data.slug)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!employee) return { employee: null, settings: null };

    const { data: settings } = await supabaseAdmin
      .from("company_settings")
      .select("company_name, logo_url, brand_color")
      .eq("id", true)
      .maybeSingle();

    return { employee, settings };
  });

const cardSearchSchema = z.object({
  src: z.string().max(32).optional(),
});

export const Route = createFileRoute("/card/$slug")({
  validateSearch: (s) => cardSearchSchema.parse(s),
  loader: async ({ params }) => {
    const res = await getPublicCard({ data: { slug: params.slug } });
    if (!res.employee) throw notFound();
    return res;
  },
  head: ({ loaderData }) => {
    const e = loaderData?.employee;
    if (!e) return { meta: [{ title: "Card not found" }] };
    const title = `${e.full_name}${e.job_title ? ` — ${e.job_title}` : ""}${e.company ? ` · ${e.company}` : ""}`;
    const desc = `Save ${e.full_name}'s contact details to your phone.`;
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        ...(e.photo_url ? [{ property: "og:image", content: e.photo_url }] : []),
      ],
    };
  },
  component: CardPage,
  notFoundComponent: () => (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="text-center">
        <h1 className="text-2xl font-semibold">Card not available</h1>
        <p className="text-muted-foreground mt-2">This contact card no longer exists.</p>
      </div>
    </div>
  ),
  errorComponent: () => (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <p className="text-muted-foreground">Couldn't load this card.</p>
    </div>
  ),
});

function CardPage() {
  const { employee, settings } = Route.useLoaderData() as any;
  const { src } = Route.useSearch();
  const e = employee;
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!e || e.disabled) return;
    const isScan = src === "qr";
    recordEmployeeEvent({
      data: {
        slug: e.slug,
        eventType: isScan ? "scan" : "view",
        source: src ?? null,
        userAgent: navigator.userAgent.slice(0, 512),
        referrer: document.referrer ? document.referrer.slice(0, 1024) : null,
      },
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [e?.slug, src]);


  if (e.disabled) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-semibold">Card unavailable</h1>
          <p className="text-muted-foreground mt-2">
            This contact card has been taken offline.
          </p>
        </div>
      </div>
    );
  }

  const brand = settings?.brand_color || "#0f172a";
  const vcfUrl = `/api/public/vcard/${encodeURIComponent(e.slug)}`;
  const shareUrl = typeof window !== "undefined" ? window.location.href : "";

  const initials = e.full_name
    .split(/\s+/)
    .map((s: string) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="min-h-screen bg-muted/30 py-6 px-4">
      <div className="mx-auto max-w-md">
        <div className="bg-card rounded-3xl shadow-xl overflow-hidden border border-border">
          {/* Header */}
          <div className="relative h-32" style={{ background: brand }}>
            {settings?.logo_url && (
              <img
                src={settings.logo_url}
                alt={settings.company_name || "Company"}
                className="absolute top-4 left-4 h-8 object-contain"
              />
            )}
          </div>

          {/* Photo */}
          <div className="-mt-16 flex flex-col items-center px-6 pb-6">
            <div
              className="w-32 h-32 rounded-full overflow-hidden ring-4 ring-card bg-muted flex items-center justify-center text-3xl font-semibold text-muted-foreground"
            >
              {e.photo_url ? (
                <img src={e.photo_url} alt={e.full_name} className="w-full h-full object-cover" />
              ) : (
                initials
              )}
            </div>

            <h1 className="mt-4 text-2xl font-semibold text-center">{e.full_name}</h1>
            {e.job_title && (
              <p className="text-muted-foreground text-center">{e.job_title}</p>
            )}
            {e.company && (
              <p className="text-sm text-muted-foreground/80 text-center">{e.company}</p>
            )}

            {/* Actions */}
            <div className="w-full mt-6 grid grid-cols-1 gap-2">
              <a
                href={vcfUrl}
                className="flex items-center justify-center gap-2 rounded-xl px-4 py-3 font-medium text-white shadow-sm transition-opacity hover:opacity-90"
                style={{ background: brand }}
              >
                <Download className="w-4 h-4" />
                Save to Contacts (vCard)
              </a>
              <WalletButtons slug={e.slug} brand={brand} />
            </div>

            {/* Contact list */}
            <div className="w-full mt-6 divide-y divide-border rounded-xl border border-border overflow-hidden">
              {e.email && (
                <ContactRow href={`mailto:${e.email}`} icon={<Mail className="w-4 h-4" />} label="Email" value={e.email} />
              )}
              {e.office_phone && (
                <ContactRow href={`tel:${e.office_phone}`} icon={<Phone className="w-4 h-4" />} label="Office" value={e.office_phone} />
              )}
              {e.mobile && (
                <ContactRow href={`tel:${e.mobile}`} icon={<Smartphone className="w-4 h-4" />} label="Mobile" value={e.mobile} />
              )}
              {e.website && (
                <ContactRow href={e.website} icon={<Globe className="w-4 h-4" />} label="Website" value={e.website.replace(/^https?:\/\//, "")} />
              )}
              {e.linkedin && (
                <ContactRow href={e.linkedin} icon={<Linkedin className="w-4 h-4" />} label="LinkedIn" value="View profile" />
              )}
            </div>

            {/* QR + share */}
            <div className="w-full mt-6 flex flex-col items-center gap-3">
              <div className="bg-white p-3 rounded-xl border border-border">
                <img
                  src={`/api/public/qr/${encodeURIComponent(e.slug)}?format=svg`}
                  alt="QR code"
                  className="w-40 h-40"
                />
              </div>
              <button
                onClick={async () => {
                  if (navigator.share) {
                    try { await navigator.share({ title: e.full_name, url: shareUrl }); return; } catch {}
                  }
                  await navigator.clipboard.writeText(shareUrl);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
                className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-2"
              >
                <QrCode className="w-4 h-4" />
                {copied ? "Link copied!" : "Share this card"}
              </button>
            </div>
          </div>
        </div>

        {settings?.company_name && (
          <p className="text-center text-xs text-muted-foreground mt-4">
            Powered by {settings.company_name}
          </p>
        )}
      </div>
    </div>
  );
}

function ContactRow({
  href, icon, label, value,
}: { href: string; icon: React.ReactNode; label: string; value: string }) {
  return (
    <a href={href} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors">
      <span className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-foreground/70">
        {icon}
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="truncate text-sm font-medium">{value}</div>
      </div>
    </a>
  );
}

function WalletButton({ slug, brand }: { slug: string; brand: string }) {
  const [status, setStatus] = useState<"idle" | "loading" | "unavailable">("idle");
  const url = `/api/public/wallet/${encodeURIComponent(slug)}`;

  const onClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    setStatus("loading");
    try {
      const res = await fetch(url);
      if (res.status === 503) {
        setStatus("unavailable");
        return;
      }
      if (!res.ok) {
        setStatus("unavailable");
        return;
      }
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = `${slug}.pkpass`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
      setStatus("idle");
    } catch {
      setStatus("unavailable");
    }
  };

  if (status === "unavailable") {
    return (
      <div className="flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm border border-border text-muted-foreground bg-muted/40">
        <Wallet className="w-4 h-4" />
        Apple Wallet not configured yet
      </div>
    );
  }

  return (
    <a
      href={url}
      onClick={onClick}
      className="flex items-center justify-center gap-2 rounded-xl px-4 py-3 font-medium border border-border hover:bg-muted/50 transition-colors"
      style={{ borderColor: brand }}
    >
      <Wallet className="w-4 h-4" />
      {status === "loading" ? "Preparing pass…" : "Add to Apple Wallet"}
    </a>
  );
}
