import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/errors")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const { listRecentErrors, clearRecentErrors } = await import(
            "@/lib/error-capture"
          );
          const url = new URL(request.url);
          const clear = url.searchParams.get("clear") === "1";
          const errors = listRecentErrors();
          if (clear) clearRecentErrors();
          return new Response(
            JSON.stringify({ count: errors.length, errors }, null, 2),
            {
              status: 200,
              headers: {
                "content-type": "application/json",
                "cache-control": "no-store",
              },
            },
          );
        } catch (err) {
          return new Response(
            JSON.stringify({
              error: err instanceof Error ? err.message : String(err),
            }),
            { status: 500, headers: { "content-type": "application/json" } },
          );
        }
      },
    },
  },
});
