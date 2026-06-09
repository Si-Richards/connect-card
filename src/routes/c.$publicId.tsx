import { createFileRoute, notFound } from "@tanstack/react-router";
import { z } from "zod";
import { Mail, Phone, Smartphone, Globe, Linkedin, Download, Wallet, Link2, Check, Share2, MapPin, Calendar } from "lucide-react";
import { useEffect, useState } from "react";
import { recordEmployeeEvent } from "@/lib/analytics.functions";
import { api } from "@/lib/api";


const cardSearchSchema = z.object({
  src: z.string().max(32).optional(),
});

export const Route = createFileRoute("/c/$publicId")({
  validateSearch: (s) => cardSearchSchema.parse(s),
  loader: async ({ params }) => {
    const res = await api.getCardByPublicId(params.publicId);
    if (!res.employee) throw notFound();
    return res;
  },
  // Cards are private capability URLs — never expose name/photo to crawlers
  // or social previewers. Stops Slack/WhatsApp from leaking the card on share.
  head: () => ({
    meta: [
      { title: "Contact card" },
      { name: "robots", content: "noindex, nofollow, noarchive, nosnippet" },
      { name: "referrer", content: "no-referrer" },
    ],
  }),
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
  const { employee, settings, tokens } = Route.useLoaderData() as any;
  const { src } = Route.useSearch();
  const e = employee;
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!e) return;
    const isScan = src === "qr";
    recordEmployeeEvent({
      data: {
        publicId: e.public_id,
        eventType: isScan ? "scan" : "view",
        source: src ?? null,
        userAgent: navigator.userAgent.slice(0, 512),
        referrer: document.referrer ? document.referrer.slice(0, 1024) : null,
      },
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [e?.public_id, src]);

  const branding = e.branding ?? {};
  const brand = branding.brand_color || settings?.brand_color || "#0f172a";
  const accent = branding.accent_color || settings?.accent_color || "#ffffff";
  const logo = branding.logo_url || settings?.logo_url;
  const cover = branding.cover_image_url || settings?.cover_image_url;
  const companyName = branding.company_name || settings?.company_name;
  const tokenQs = (t: { exp: number; sig: string }) => `?exp=${t.exp}&sig=${encodeURIComponent(t.sig)}`;
  const vcfUrl = tokens
    ? `/api/public/vcard/${encodeURIComponent(e.public_id)}${tokenQs(tokens.vcard)}`
    : `/api/public/vcard/${encodeURIComponent(e.public_id)}`;
  const shareUrl = typeof window !== "undefined" ? window.location.href : "";

  const initials = e.full_name
    .split(/\s+/)
    .map((s: string) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const onBookingClick = () => {
    recordEmployeeEvent({
      data: {
        publicId: e.public_id,
        eventType: "booking_click",
        source: null,
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 512) : null,
        referrer: typeof document !== "undefined" && document.referrer ? document.referrer.slice(0, 1024) : null,
      },
    }).catch(() => {});
  };

  return (
    <div
      className="min-h-screen bg-muted/30 py-6 px-4"
      style={{ ["--brand" as any]: brand, ["--brand-accent" as any]: accent }}
    >
      <div className="mx-auto max-w-md">
        <div className="bg-card rounded-3xl shadow-xl overflow-hidden border border-border">
          <div
            className="relative h-32 mb-4"
            style={
              cover
                ? { backgroundImage: `url(${cover})`, backgroundSize: "cover", backgroundPosition: "center" }
                : { background: brand }
            }
          >
            {logo && (
              <img
                src={logo}
                alt={companyName || "Company"}
                className="absolute top-4 left-4 h-8 object-contain drop-shadow"
              />
            )}
          </div>

          <div className="flex flex-col items-center px-6 pb-6">
            <div className="w-32 h-32 rounded-full overflow-hidden ring-4 ring-card bg-muted flex items-center justify-center text-3xl font-semibold text-muted-foreground">
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

            <div className="w-full mt-6 grid grid-cols-1 gap-2">
              <a
                href={vcfUrl}
                className="flex items-center justify-center gap-2 rounded-xl px-4 py-3 font-medium text-white shadow-sm transition-opacity hover:opacity-90"
                style={{ background: brand }}
              >
                <Download className="w-4 h-4" />
                Save to Contacts (vCard)
              </a>
              {e.booking_url && (
                <a
                  href={e.booking_url}
                  target="_blank"
                  rel="noreferrer"
                  onClick={onBookingClick}
                  className="flex items-center justify-center gap-2 rounded-xl px-4 py-3 font-medium border-2 transition-colors hover:bg-muted/40"
                  style={{ borderColor: brand, color: brand }}
                >
                  <Calendar className="w-4 h-4" />
                  Book a meeting
                </a>
              )}
              <WalletButtons publicId={e.public_id} fullName={e.full_name} brand={brand} tokens={tokens} />
            </div>

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
              {e.address && (
                <ContactRow
                  href={`https://maps.google.com/?q=${encodeURIComponent(e.address)}`}
                  icon={<MapPin className="w-4 h-4" />}
                  label="Address"
                  value={e.address}
                />
              )}
            </div>

            <div className="w-full mt-6 flex flex-col items-center gap-3">
              <div className="bg-white p-3 rounded-xl border border-border">
                <img
                  src={`/api/public/qr/${encodeURIComponent(e.public_id)}?format=png`}
                  alt="QR code"
                  className="w-64 h-64"
                />
              </div>

              <div className="flex items-center gap-2 w-full">
                <button
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(shareUrl);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1500);
                    } catch {}
                  }}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium border border-border bg-background hover:bg-muted transition-colors"
                  aria-label="Copy private link"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Link2 className="w-4 h-4" />}
                  {copied ? "Link copied!" : "Copy link"}
                </button>
                {typeof navigator !== "undefined" && "share" in navigator && (
                  <button
                    onClick={async () => {
                      const safeName = (e.full_name || e.public_id).replace(/\s+/g, "-");
                      try {
                        const res = await fetch(vcfUrl);
                        if (res.ok) {
                          const blob = await res.blob();
                          const file = new File([blob], `${safeName}.vcf`, { type: "text/vcard" });
                          const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
                          if (nav.canShare?.({ files: [file] })) {
                            await navigator.share({ files: [file], title: e.full_name, text: e.full_name });
                            return;
                          }
                        }
                      } catch (err: any) {
                        if (err?.name === "AbortError") return;
                      }
                      try { await navigator.share({ title: e.full_name, url: shareUrl }); } catch {}
                    }}
                    className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium border border-border bg-background hover:bg-muted transition-colors"
                    aria-label="Share contact"
                  >
                    <Share2 className="w-4 h-4" />
                  </button>
                )}

              </div>
            </div>
          </div>
        </div>

        {companyName && (
          <div className="flex items-center justify-center gap-2 mt-6 opacity-70">
            {logo && <img src={logo} alt="" className="h-4 w-4 object-contain" />}
            <p className="text-center text-xs text-muted-foreground">{companyName}</p>
          </div>
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

function WalletButtons({
  publicId,
  fullName,
  brand,
  tokens,
}: {
  publicId: string;
  fullName: string;
  brand: string;
  tokens: {
    apple: { exp: number; sig: string };
    google: { exp: number; sig: string };
  } | null;
}) {
  const [available, setAvailable] = useState<{ apple: boolean; google: boolean } | null>(null);
  const [appleStatus, setAppleStatus] = useState<"idle" | "loading">("idle");
  const [shareStatus, setShareStatus] = useState<"idle" | "loading">("idle");
  const [canShare, setCanShare] = useState(false);

  useEffect(() => {
    setCanShare(typeof navigator !== "undefined" && "share" in navigator);
    fetch("/api/public/wallet-status")
      .then((r) => (r.ok ? r.json() : { apple: false, google: false }))
      .then(setAvailable)
      .catch(() => setAvailable({ apple: false, google: false }));
  }, []);

  if (!available) return null;
  if (!available.apple && !available.google) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm border border-border text-muted-foreground bg-muted/40">
        <Wallet className="w-4 h-4" />
        Wallet passes not configured yet
      </div>
    );
  }

  const tokenQs = (t: { exp: number; sig: string }) =>
    `?exp=${t.exp}&sig=${encodeURIComponent(t.sig)}`;
  const appleUrl = `/api/public/wallet/${encodeURIComponent(publicId)}${tokens ? tokenQs(tokens.apple) : ""}`;
  const googleUrl = `/api/public/google-wallet/${encodeURIComponent(publicId)}${tokens ? tokenQs(tokens.google) : ""}`;

  const safeFileName = (fullName || publicId).replace(/[^\w\-]+/g, "-");

  const onAppleClick = async (ev: React.MouseEvent) => {
    ev.preventDefault();
    setAppleStatus("loading");
    try {
      const res = await fetch(appleUrl);
      if (!res.ok) {
        setAppleStatus("idle");
        return;
      }
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = `${safeFileName}.pkpass`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
    } finally {
      setAppleStatus("idle");
    }
  };

  const onAppleShare = async (ev: React.MouseEvent) => {
    ev.preventDefault();
    ev.stopPropagation();
    setShareStatus("loading");
    const title = `${fullName || "Contact"} — Apple Wallet pass`;
    try {
      const res = await fetch(appleUrl);
      if (res.ok) {
        const blob = await res.blob();
        const file = new File([blob], `${safeFileName}.pkpass`, {
          type: "application/vnd.apple.pkpass",
        });
        const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
        if (nav.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file], title });
          return;
        }
      }
      try {
        await navigator.share({ title, url: new URL(appleUrl, window.location.origin).toString() });
      } catch (err: any) {
        if (err?.name !== "AbortError") throw err;
      }
    } catch (err: any) {
      if (err?.name === "AbortError") return;
    } finally {
      setShareStatus("idle");
    }
  };

  return (
    <>
      {available.apple && (
        <div className="flex items-center gap-2">
          <a
            href={appleUrl}
            onClick={onAppleClick}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl px-4 py-3 font-medium border border-border hover:bg-muted/50 transition-colors"
            style={{ borderColor: brand }}
          >
            <Wallet className="w-4 h-4" />
            {appleStatus === "loading" ? "Preparing pass…" : "Add to Apple Wallet"}
          </a>
          {canShare && (
            <button
              type="button"
              onClick={onAppleShare}
              disabled={shareStatus === "loading"}
              aria-label="Share Apple Wallet pass"
              title="Share pass (AirDrop, Messages, Mail…)"
              className="inline-flex items-center justify-center rounded-xl px-3 py-3 border border-border hover:bg-muted/50 transition-colors disabled:opacity-60"
              style={{ borderColor: brand }}
            >
              <Share2 className="w-4 h-4" />
            </button>
          )}
        </div>
      )}
      {available.google && (
        <a
          href={googleUrl}
          className="flex items-center justify-center gap-2 rounded-xl px-4 py-3 font-medium border border-border hover:bg-muted/50 transition-colors"
          style={{ borderColor: brand }}
        >
          <Wallet className="w-4 h-4" />
          Add to Google Wallet
        </a>
      )}
    </>
  );
}
