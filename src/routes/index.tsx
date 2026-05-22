import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, QrCode, Wallet, Smartphone } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Digital Business Cards" },
      { name: "description", content: "Share contact details instantly via QR — no app required." },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="font-semibold tracking-tight">CardKit</div>
          <Link
            to="/login"
            className="text-sm font-medium rounded-md px-4 py-2 bg-primary text-primary-foreground hover:opacity-90"
          >
            Admin sign in
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-20">
        <div className="max-w-2xl">
          <h1 className="text-5xl md:text-6xl font-semibold tracking-tight">
            Digital business cards for your whole team.
          </h1>
          <p className="mt-6 text-lg text-muted-foreground">
            Create a shareable card for every employee. Visitors scan a QR code and save
            the contact straight to their phone — no app required.
          </p>
          <div className="mt-8 flex gap-3">
            <Link
              to="/login"
              className="inline-flex items-center gap-2 rounded-md px-5 py-3 font-medium bg-primary text-primary-foreground hover:opacity-90"
            >
              Get started <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mt-20">
          <Feature icon={<QrCode className="w-5 h-5" />} title="QR sharing" desc="Each employee gets a unique QR code linking to their card." />
          <Feature icon={<Smartphone className="w-5 h-5" />} title="Save to phone" desc="One tap downloads a .vcf vCard to iPhone or Android." />
          <Feature icon={<Wallet className="w-5 h-5" />} title="Wallet-ready" desc="Apple Wallet pass support once your certificate is configured." />
        </div>
      </main>
    </div>
  );
}

function Feature({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="rounded-xl border border-border p-5">
      <div className="w-9 h-9 rounded-md bg-muted flex items-center justify-center mb-3">{icon}</div>
      <div className="font-medium">{title}</div>
      <p className="text-sm text-muted-foreground mt-1">{desc}</p>
    </div>
  );
}
