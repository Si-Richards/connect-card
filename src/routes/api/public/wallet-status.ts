import { createFileRoute } from "@tanstack/react-router";

/**
 * Public, no-auth status endpoint so the card page knows which wallet buttons
 * to render. Returns booleans only — never leak credential details.
 */
export const Route = createFileRoute("/api/public/wallet-status")({
  server: {
    handlers: {
      GET: async () => {
        const { getAppleWalletConfig, getGoogleWalletConfig } = await import(
          "@/lib/wallet-config.server"
        );
        return Response.json({
          apple: getAppleWalletConfig() !== null,
          google: getGoogleWalletConfig() !== null,
        });
      },
    },
  },
});
