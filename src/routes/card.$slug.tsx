import { createFileRoute, redirect } from "@tanstack/react-router";

// Legacy slug-based card URL is retired for privacy (was enumerable).
// All public access is now via /c/:publicId (128-bit unguessable ID).
// We can't auto-redirect without leaking the slug→public_id mapping, so
// we render a friendly notice and tell visitors to rescan the QR.
export const Route = createFileRoute("/card/$slug")({
  head: () => ({
    meta: [
      { title: "Card moved" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: LegacyCardPage,
});

function LegacyCardPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="text-center max-w-md">
        <h1 className="text-2xl font-semibold">This link has moved</h1>
        <p className="text-muted-foreground mt-2">
          Contact cards now use private URLs. Please rescan the QR code or
          ask the cardholder to share their new link.
        </p>
      </div>
    </div>
  );
}
