/**
 * Central server-side configuration. Server-only — never import from client code.
 *
 * This is the **single place** where the app reads `process.env` (the Supabase
 * integration files are auto-generated and excluded).
 *
 * Every getter returns either a fully-typed config object or `null` when the
 * required secrets aren't set, so callers can gracefully degrade instead of
 * throwing at request time.
 *
 * To add a new integration:
 *   1. Add a typed `XxxConfig` shape below.
 *   2. Add a `getXxxConfig()` getter that reads from `env()`.
 *   3. Document the required keys in INSTALL.md.
 */

/** Trim + treat empty strings as missing. */
function env(name: string): string | undefined {
  const v = process.env[name];
  if (v === undefined) return undefined;
  const trimmed = v.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

// ============================================================================
// Apple Wallet
// ============================================================================

export type AppleWalletConfig = {
  passTypeId: string;
  teamId: string;
  /** PKCS#12 bundle (cert + private key), base64-encoded. */
  p12Base64: string;
  p12Password: string;
  /** Apple WWDR intermediate certificate, base64-encoded (DER or PEM). */
  wwdrBase64: string;
};

export function getAppleWalletConfig(): AppleWalletConfig | null {
  const passTypeId = env("APPLE_PASS_TYPE_ID");
  const teamId = env("APPLE_TEAM_ID");
  const p12Base64 = env("APPLE_PASS_P12_BASE64");
  const p12Password = env("APPLE_PASS_P12_PASSWORD");
  const wwdrBase64 = env("APPLE_WWDR_BASE64");
  if (!passTypeId || !teamId || !p12Base64 || !p12Password || !wwdrBase64) {
    return null;
  }
  return { passTypeId, teamId, p12Base64, p12Password, wwdrBase64 };
}

// ============================================================================
// Google Wallet
// ============================================================================

export type GoogleWalletConfig = {
  /** Numeric issuer ID from the Google Wallet Console. */
  issuerId: string;
  /** Service-account email (e.g. wallet@my-project.iam.gserviceaccount.com). */
  serviceAccountEmail: string;
  /** Service-account RSA private key (PEM). Literal `\n` escapes are normalised. */
  serviceAccountPrivateKey: string;
  /**
   * Suffix for the GenericClass id `${issuerId}.${classSuffix}`.
   * Defaults to `business_card`.
   */
  classSuffix: string;
};

export function getGoogleWalletConfig(): GoogleWalletConfig | null {
  const issuerId = env("GOOGLE_WALLET_ISSUER_ID");
  const serviceAccountEmail = env("GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL");
  const rawKey = env("GOOGLE_WALLET_SERVICE_ACCOUNT_PRIVATE_KEY");
  if (!issuerId || !serviceAccountEmail || !rawKey) return null;

  return {
    issuerId,
    serviceAccountEmail,
    serviceAccountPrivateKey: rawKey.replace(/\\n/g, "\n"),
    classSuffix: env("GOOGLE_WALLET_CLASS_SUFFIX") || "business_card",
  };
}

// ============================================================================
// Convenience: snapshot of which integrations are configured
// ============================================================================

export function getIntegrationsStatus() {
  return {
    appleWallet: getAppleWalletConfig() !== null,
    googleWallet: getGoogleWalletConfig() !== null,
  };
}
