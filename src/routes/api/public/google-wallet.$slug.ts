import { createFileRoute } from "@tanstack/react-router";
import { createSign } from "crypto";

/**
 * Generates a Google Wallet "Save to Google Pay" link for an employee card
 * and 302-redirects the user there. The pass is a GenericObject that
 * references a single GenericClass (`${issuerId}.${classSuffix}`) which
 * must exist in the Google Wallet Console — see INSTALL.md.
 */
export const Route = createFileRoute("/api/public/google-wallet/$slug")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        try {
          const { getGoogleWalletConfig } = await import("@/lib/config.server");
          const cfg = getGoogleWalletConfig();
          if (!cfg) {
            return new Response(
              "Google Wallet is not configured yet. The admin needs to add a Google Wallet service account.",
              { status: 503 },
            );
          }

          const slug = params.slug.replace(/\.jwt$/i, "");
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data: e, error } = await supabaseAdmin
            .from("employees")
            .select("*")
            .eq("slug", slug)
            .eq("disabled", false)
            .maybeSingle();
          if (error || !e) return new Response("Not found", { status: 404 });

          const { data: settings } = await supabaseAdmin
            .from("company_settings")
            .select("company_name, brand_color, logo_url")
            .eq("id", true)
            .maybeSingle();

          const origin = new URL(request.url).origin;
          const cardUrl = `${origin}/card/${encodeURIComponent(slug)}`;
          const classId = `${cfg.issuerId}.${cfg.classSuffix}`;
          // Stable per-employee object ID
          const objectId = `${cfg.issuerId}.card-${e.id.replace(/-/g, "")}`;

          const genericObject = {
            id: objectId,
            classId,
            genericType: "GENERIC_TYPE_UNSPECIFIED",
            hexBackgroundColor: settings?.brand_color || "#0f172a",
            logo: settings?.logo_url
              ? { sourceUri: { uri: settings.logo_url } }
              : undefined,
            cardTitle: {
              defaultValue: {
                language: "en",
                value: settings?.company_name || e.company || "Business Card",
              },
            },
            subheader: {
              defaultValue: { language: "en", value: e.job_title || "" },
            },
            header: {
              defaultValue: { language: "en", value: e.full_name },
            },
            heroImage: e.photo_url
              ? { sourceUri: { uri: e.photo_url } }
              : undefined,
            textModulesData: [
              e.email && { id: "email", header: "Email", body: e.email },
              e.mobile && { id: "mobile", header: "Mobile", body: e.mobile },
              e.office_phone && { id: "office", header: "Office", body: e.office_phone },
              e.website && { id: "website", header: "Website", body: e.website },
              e.linkedin && { id: "linkedin", header: "LinkedIn", body: e.linkedin },
              e.notes && { id: "notes", header: "Notes", body: e.notes },
            ].filter(Boolean),
            linksModuleData: {
              uris: [
                { uri: cardUrl, description: "View digital business card", id: "card" },
                e.email && { uri: `mailto:${e.email}`, description: "Email", id: "email-link" },
                e.mobile && { uri: `tel:${e.mobile}`, description: "Call mobile", id: "mobile-link" },
                e.website && { uri: e.website, description: "Website", id: "website-link" },
              ].filter(Boolean),
            },
            barcode: {
              type: "QR_CODE",
              value: cardUrl,
              alternateText: e.full_name,
            },
          };

          const claims = {
            iss: cfg.serviceAccountEmail,
            aud: "google",
            typ: "savetowallet",
            iat: Math.floor(Date.now() / 1000),
            origins: [origin],
            payload: {
              genericObjects: [genericObject],
            },
          };

          const jwt = signRs256(claims, cfg.serviceAccountPrivateKey);
          const saveUrl = `https://pay.google.com/gp/v/save/${jwt}`;
          return Response.redirect(saveUrl, 302);
        } catch (err) {
          console.error("google wallet generation failed", err);
          return new Response("Google Wallet is temporarily unavailable.", {
            status: 503,
            headers: { "Content-Type": "text/plain; charset=utf-8" },
          });
        }
      },
    },
  },
});

function base64url(input: Buffer | string): string {
  const b = typeof input === "string" ? Buffer.from(input) : input;
  return b.toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function signRs256(payload: object, privateKeyPem: string): string {
  const header = { alg: "RS256", typ: "JWT" };
  const encodedHeader = base64url(JSON.stringify(header));
  const encodedPayload = base64url(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signer = createSign("RSA-SHA256");
  signer.update(signingInput);
  signer.end();
  const signature = base64url(signer.sign(privateKeyPem));
  return `${signingInput}.${signature}`;
}
