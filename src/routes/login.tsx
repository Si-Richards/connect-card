import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { api, ApiError } from "@/lib/api";

type Step =
  | { kind: "password" }
  | { kind: "verify" }
  | { kind: "enroll-load" }
  | { kind: "enroll"; otpauthUrl: string; secret: string; qrDataUrl: string }
  | { kind: "recovery"; codes: string[] };

export const Route = createFileRoute("/login")({
  validateSearch: (s: Record<string, unknown>) => ({
    redirect: typeof s.redirect === "string" ? s.redirect : "/admin",
  }),
  component: LoginPage,
});

function LoginPage() {
  const { redirect } = Route.useSearch();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>({ kind: "password" });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [useRecovery, setUseRecovery] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const codeInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (step.kind === "verify" || step.kind === "enroll") {
      codeInputRef.current?.focus();
    }
  }, [step.kind]);

  function describeError(err: unknown, fallback: string) {
    if (err instanceof ApiError) {
      if (err.status === 401) return "Invalid code or session expired.";
      if (err.status === 429) return "Too many attempts. Try again in a few minutes.";
      if (err.status === 400) return "Invalid code.";
    }
    return fallback;
  }

  async function onPasswordSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { next } = await api.login(email, password);
      setCode("");
      if (next === "verify") {
        setStep({ kind: "verify" });
      } else {
        setStep({ kind: "enroll-load" });
        const enroll = await api.mfaEnrollStart();
        setStep({ kind: "enroll", ...enroll });
      }
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 401
          ? "Invalid email or password."
          : "Sign in failed. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function onVerifySubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.mfaVerify(code);
      navigate({ to: redirect || "/admin" });
    } catch (err) {
      setError(describeError(err, "Verification failed."));
    } finally {
      setBusy(false);
    }
  }

  async function onEnrollConfirm(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { recoveryCodes } = await api.mfaEnrollConfirm(code);
      setStep({ kind: "recovery", codes: recoveryCodes });
    } catch (err) {
      setError(describeError(err, "Could not confirm code."));
    } finally {
      setBusy(false);
    }
  }

  async function backToPassword() {
    await api.logout().catch(() => {});
    setCode("");
    setPassword("");
    setUseRecovery(false);
    setError(null);
    setStep({ kind: "password" });
  }

  function finishRecovery() {
    navigate({ to: redirect || "/admin" });
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-6 space-y-4 shadow-sm">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">CardKit Admin</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {step.kind === "password" && "Sign in to manage cards."}
            {step.kind === "verify" && "Enter the 6-digit code from your authenticator app."}
            {(step.kind === "enroll-load" || step.kind === "enroll") &&
              "Set up two-factor authentication to continue."}
            {step.kind === "recovery" && "Save these recovery codes somewhere safe."}
          </p>
        </div>

        {error && (
          <div className="text-sm rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-destructive">
            {error}
          </div>
        )}

        {step.kind === "password" && (
          <form onSubmit={onPasswordSubmit} className="space-y-4">
            <Field label="Email" htmlFor="email">
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="Password" htmlFor="password">
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputCls}
              />
            </Field>
            <SubmitButton busy={busy}>Continue</SubmitButton>
          </form>
        )}

        {step.kind === "verify" && (
          <form onSubmit={onVerifySubmit} className="space-y-4">
            <Field label={useRecovery ? "Recovery code" : "Authenticator code"} htmlFor="code">
              <input
                id="code"
                ref={codeInputRef}
                type="text"
                inputMode={useRecovery ? "text" : "numeric"}
                autoComplete="one-time-code"
                required
                value={code}
                onChange={(e) =>
                  setCode(
                    useRecovery
                      ? e.target.value.toUpperCase().slice(0, 12)
                      : e.target.value.replace(/\D/g, "").slice(0, 6),
                  )
                }
                placeholder={useRecovery ? "XXXX-XXXX" : "123456"}
                className={`${inputCls} tracking-[0.3em] text-center font-mono`}
              />
            </Field>
            <SubmitButton busy={busy}>Verify</SubmitButton>
            <div className="flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={() => {
                  setUseRecovery((v) => !v);
                  setCode("");
                  setError(null);
                }}
                className="text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
              >
                {useRecovery ? "Use authenticator code" : "Use a recovery code instead"}
              </button>
              <button
                type="button"
                onClick={backToPassword}
                className="text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
              >
                Back to sign in
              </button>
            </div>
          </form>
        )}

        {step.kind === "enroll-load" && (
          <div className="text-sm text-muted-foreground">Generating QR code…</div>
        )}

        {step.kind === "enroll" && (
          <form onSubmit={onEnrollConfirm} className="space-y-4">
            <div className="rounded-md border border-border bg-background p-3 flex flex-col items-center gap-3">
              <img
                src={step.qrDataUrl}
                alt="Authenticator QR code"
                className="h-44 w-44 rounded"
              />
              <div className="text-xs text-muted-foreground text-center space-y-1">
                <div>Scan with Google Authenticator, 1Password, Authy…</div>
                <div>
                  Or enter this key manually:
                  <div className="mt-1 font-mono text-foreground tracking-wider break-all">
                    {step.secret}
                  </div>
                </div>
              </div>
            </div>
            <Field label="Enter the 6-digit code to confirm" htmlFor="code">
              <input
                id="code"
                ref={codeInputRef}
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="123456"
                className={`${inputCls} tracking-[0.3em] text-center font-mono`}
              />
            </Field>
            <SubmitButton busy={busy}>Confirm and sign in</SubmitButton>
            <button
              type="button"
              onClick={backToPassword}
              className="w-full text-xs text-muted-foreground hover:text-foreground"
            >
              Back to sign in
            </button>
          </form>
        )}

        {step.kind === "recovery" && (
          <RecoveryCodes codes={step.codes} onContinue={finishRecovery} />
        )}

        <div className="pt-2 text-xs text-muted-foreground">
          <Link to="/" className="hover:text-foreground underline-offset-2 hover:underline">
            ← Back to site
          </Link>
        </div>
      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
      </label>
      {children}
    </div>
  );
}

function SubmitButton({ busy, children }: { busy: boolean; children: React.ReactNode }) {
  return (
    <button
      type="submit"
      disabled={busy}
      className="w-full inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
    >
      {busy ? "Please wait…" : children}
    </button>
  );
}

function RecoveryCodes({ codes, onContinue }: { codes: string[]; onContinue: () => void }) {
  const [acknowledged, setAcknowledged] = useState(false);
  const [copied, setCopied] = useState(false);

  const text = codes.join("\n");

  async function copyAll() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  }

  function download() {
    const blob = new Blob([`CardKit Admin — recovery codes\n\n${text}\n`], {
      type: "text/plain;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "cardkit-recovery-codes.txt";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
        Each code can be used once if you lose your authenticator. They won't be shown again.
      </div>
      <div className="grid grid-cols-2 gap-2 font-mono text-sm">
        {codes.map((c) => (
          <div
            key={c}
            className="rounded-md border border-border bg-background px-2 py-1.5 text-center"
          >
            {c}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={copyAll}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-accent"
        >
          {copied ? "Copied" : "Copy all"}
        </button>
        <button
          type="button"
          onClick={download}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-accent"
        >
          Download .txt
        </button>
      </div>
      <label className="flex items-start gap-2 text-xs text-muted-foreground">
        <input
          type="checkbox"
          checked={acknowledged}
          onChange={(e) => setAcknowledged(e.target.checked)}
          className="mt-0.5"
        />
        <span>I've saved these recovery codes somewhere safe.</span>
      </label>
      <button
        type="button"
        disabled={!acknowledged}
        onClick={onContinue}
        className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
      >
        Continue
      </button>
    </div>
  );
}
