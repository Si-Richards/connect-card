import { createFileRoute } from "@tanstack/react-router";

/**
 * Liveness check for the TanStack frontend worker. All data/PDF/QR/Wallet
 * endpoints now live in the self-hosted Express + MySQL backend; this route
 * only confirms the SSR worker is up.
 */
export const Route = createFileRoute("/api/public/healthcheck")({
  server: {
    handlers: {
      GET: async () =>
        new Response(
          JSON.stringify({ status: "ok", timestamp: new Date().toISOString() }, null, 2),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
    },
  },
});
