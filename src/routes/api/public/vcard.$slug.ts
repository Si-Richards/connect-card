import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/vcard/$slug")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        try {
          const [{ supabaseAdmin }, { buildVCard }] = await Promise.all([
            import("@/integrations/supabase/client.server"),
            import("@/lib/vcard"),
          ]);
          const slug = params.slug.replace(/\.vcf$/i, "");
          const { data, error } = await supabaseAdmin
            .from("employees")
            .select("*")
            .eq("slug", slug)
            .eq("disabled", false)
            .maybeSingle();
          if (error || !data) return new Response("Not found", { status: 404 });
          const vcf = buildVCard(data as any);
          const filename = `${slug}.vcf`;
          return new Response(vcf, {
            status: 200,
            headers: {
              "Content-Type": "text/vcard; charset=utf-8",
              "Content-Disposition": `attachment; filename="${filename}"`,
              "Cache-Control": "no-store",
            },
          });
        } catch (err) {
          console.error("vcard generation failed", err);
          return new Response("vCard download is temporarily unavailable.", {
            status: 503,
            headers: { "Content-Type": "text/plain; charset=utf-8" },
          });
        }
      },
    },
  },
});
