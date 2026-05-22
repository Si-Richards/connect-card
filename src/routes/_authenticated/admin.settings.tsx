import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export const Route = createFileRoute("/_authenticated/admin/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["settings"], queryFn: () => api.getSettings() });

  const [companyName, setCompanyName] = useState("");
  const [brandColor, setBrandColor] = useState("#3b82f6");
  const [logoUrl, setLogoUrl] = useState("");
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  useEffect(() => {
    if (q.data?.settings) {
      setCompanyName(q.data.settings.company_name ?? "");
      setBrandColor(q.data.settings.brand_color ?? "#3b82f6");
      setLogoUrl(q.data.settings.logo_url ?? "");
    }
  }, [q.data]);

  const saveM = useMutation({
    mutationFn: () =>
      api.updateSettings({
        company_name: companyName || null,
        brand_color: brandColor || null,
        logo_url: logoUrl || null,
      }),
    onSuccess: () => {
      setSavedMsg("Saved.");
      qc.invalidateQueries({ queryKey: ["settings"] });
      setTimeout(() => setSavedMsg(null), 2000);
    },
  });

  const uploadM = useMutation({
    mutationFn: (file: File) => api.uploadFile(file, "company-asset"),
    onSuccess: ({ url }) => setLogoUrl(url),
  });

  if (q.isLoading) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Company settings</h1>
        <p className="text-sm text-muted-foreground">
          Branding applied across all employee cards.
        </p>
      </header>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          saveM.mutate();
        }}
        className="space-y-5 rounded-lg border border-border bg-card p-5"
      >
        <div className="space-y-2">
          <label className="text-sm font-medium">Company name</label>
          <input
            type="text"
            maxLength={120}
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="Acme Inc."
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Brand color</label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={brandColor}
              onChange={(e) => setBrandColor(e.target.value)}
              className="h-10 w-14 rounded border border-input bg-background cursor-pointer"
            />
            <input
              type="text"
              value={brandColor}
              onChange={(e) => setBrandColor(e.target.value)}
              maxLength={32}
              className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
              placeholder="#3b82f6"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Logo</label>
          <div className="flex items-center gap-4">
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" className="h-14 w-14 rounded-md border border-border object-contain bg-background" />
            ) : (
              <div className="h-14 w-14 rounded-md border border-dashed border-border bg-muted/30" />
            )}
            <div className="flex-1 space-y-2">
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadM.mutate(f);
                }}
                className="text-sm"
              />
              <input
                type="text"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="Or paste a URL"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
              />
              {uploadM.isPending && <p className="text-xs text-muted-foreground">Uploading…</p>}
              {uploadM.isError && <p className="text-xs text-destructive">Upload failed.</p>}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-border">
          <div className="text-xs text-muted-foreground">
            {saveM.isError && <span className="text-destructive">Save failed.</span>}
            {savedMsg}
          </div>
          <button
            type="submit"
            disabled={saveM.isPending}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {saveM.isPending ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>
    </div>
  );
}
