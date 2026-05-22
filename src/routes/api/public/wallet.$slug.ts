import { createFileRoute } from "@tanstack/react-router";
import { PKPass } from "passkit-generator";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

function missingSecrets() {
  return (
    !process.env.APPLE_PASS_P12_BASE64 ||
    !process.env.APPLE_PASS_P12_PASSWORD ||
    !process.env.APPLE_PASS_TYPE_ID ||
    !process.env.APPLE_TEAM_ID ||
    !process.env.APPLE_WWDR_BASE64
  );
}

export const Route = createFileRoute("/api/public/wallet/$slug")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        if (missingSecrets()) {
          return new Response(
            "Apple Wallet is not configured yet. The admin needs to upload an Apple Pass Type ID certificate.",
            { status: 503 },
          );
        }

        const slug = params.slug.replace(/\.pkpass$/i, "");
        const { data: e, error } = await supabaseAdmin
          .from("employees")
          .select("*")
          .eq("slug", slug)
          .eq("disabled", false)
          .maybeSingle();
        if (error || !e) return new Response("Not found", { status: 404 });

        const { data: settings } = await supabaseAdmin
          .from("company_settings")
          .select("company_name, brand_color")
          .eq("id", true)
          .maybeSingle();

        const origin = new URL(request.url).origin;
        const cardUrl = `${origin}/card/${encodeURIComponent(slug)}`;

        try {
          const signerCert = Buffer.from(process.env.APPLE_PASS_P12_BASE64!, "base64");
          const wwdr = Buffer.from(process.env.APPLE_WWDR_BASE64!, "base64");

          const pass = new PKPass(
            {},
            {
              wwdr,
              signerCert,
              signerKey: signerCert,
              signerKeyPassphrase: process.env.APPLE_PASS_P12_PASSWORD!,
            },
            {
              formatVersion: 1,
              passTypeIdentifier: process.env.APPLE_PASS_TYPE_ID!,
              teamIdentifier: process.env.APPLE_TEAM_ID!,
              organizationName: settings?.company_name || e.company || "Business Card",
              serialNumber: e.id,
              description: `${e.full_name} — Business Card`,
              foregroundColor: "rgb(255,255,255)",
              backgroundColor: hexToRgbString(settings?.brand_color || "#0f172a"),
              labelColor: "rgb(255,255,255)",
            },
          );

          pass.type = "generic";

          pass.headerFields.push({ key: "company", label: "Company", value: e.company || "" });
          pass.primaryFields.push({ key: "name", label: "Name", value: e.full_name });
          pass.secondaryFields.push({ key: "title", label: "Title", value: e.job_title || "" });
          if (e.email)
            pass.auxiliaryFields.push({ key: "email", label: "Email", value: e.email });
          if (e.mobile)
            pass.backFields.push({ key: "mobile", label: "Mobile", value: e.mobile });
          if (e.office_phone)
            pass.backFields.push({ key: "office", label: "Office", value: e.office_phone });
          if (e.website)
            pass.backFields.push({ key: "website", label: "Website", value: e.website });
          if (e.linkedin)
            pass.backFields.push({ key: "linkedin", label: "LinkedIn", value: e.linkedin });
          if (e.notes)
            pass.backFields.push({ key: "notes", label: "Notes", value: e.notes });

          pass.setBarcodes({
            format: "PKBarcodeFormatQR",
            message: cardUrl,
            messageEncoding: "iso-8859-1",
          });

          // Try to attach photo as thumbnail
          if (e.photo_url) {
            try {
              const res = await fetch(e.photo_url);
              if (res.ok) {
                const buf = Buffer.from(await res.arrayBuffer());
                pass.addBuffer("thumbnail.png", buf);
                pass.addBuffer("thumbnail@2x.png", buf);
              }
            } catch {
              // photo optional
            }
          }

          const stream = pass.getAsBuffer();
          return new Response(new Uint8Array(stream), {
            status: 200,
            headers: {
              "Content-Type": "application/vnd.apple.pkpass",
              "Content-Disposition": `attachment; filename="${slug}.pkpass"`,
              "Cache-Control": "no-store",
            },
          });
        } catch (err) {
          console.error("pkpass generation failed", err);
          return new Response("Could not generate Wallet pass", { status: 500 });
        }
      },
    },
  },
});

function hexToRgbString(hex: string): string {
  const m = hex.replace("#", "").match(/^([0-9a-f]{6})$/i);
  if (!m) return "rgb(15,23,42)";
  const n = parseInt(m[1], 16);
  return `rgb(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255})`;
}
