import { createFileRoute } from "@tanstack/react-router";
import { buildVCard } from "@/lib/vcard";

export const Route = createFileRoute("/api/public/vcard/$slug")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
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
      },
    },
  },
});
