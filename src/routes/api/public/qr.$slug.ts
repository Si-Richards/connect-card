import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/qr/$slug")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        try {
          const [{ default: QRCode }, { supabaseAdmin }] = await Promise.all([
            import("qrcode"),
            import("@/integrations/supabase/client.server"),
          ]);
          const url = new URL(request.url);
          const format = (url.searchParams.get("format") ?? "png").toLowerCase();
          const slug = params.slug.replace(/\.(png|svg)$/i, "");

          const { data } = await supabaseAdmin
            .from("employees")
            .select("id")
            .eq("slug", slug)
            .eq("disabled", false)
            .maybeSingle();
          if (!data) return new Response("Not found", { status: 404 });

          const origin = url.origin;
          const target = `${origin}/card/${encodeURIComponent(slug)}?src=qr`;
          const opts = { width: 600, margin: 1, color: { dark: "#000000", light: "#ffffff" } };

          if (format === "svg") {
            const svg = await QRCode.toString(target, { ...opts, type: "svg" });
            return new Response(svg, {
              headers: {
                "Content-Type": "image/svg+xml",
                "Cache-Control": "public, max-age=300",
              },
            });
          }
          const buf = await QRCode.toBuffer(target, { ...opts, type: "png" });
          return new Response(new Uint8Array(buf), {
            headers: {
              "Content-Type": "image/png",
              "Cache-Control": "public, max-age=300",
            },
          });
        } catch (err) {
          console.error("qr generation failed", err);
          return new Response("QR code generation is temporarily unavailable.", {
            status: 503,
            headers: { "Content-Type": "text/plain; charset=utf-8" },
          });
        }
      },
    },
  },
});
