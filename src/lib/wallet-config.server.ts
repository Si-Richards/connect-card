/**
 * Central wallet configuration. Server-only.
 *
 * Reads all Apple & Google Wallet credentials from environment variables and
 * exposes typed getters that return `null` when the wallet is not configured.
 *
 * Add new env vars HERE, not scattered across route handlers.
 */

export type AppleWalletConfig = {
  passTypeId: string;
  teamId: string;
  /** PKCS#12 bundle (cert + private key), base64 encoded. */
  p12Base64: string;
  p12Password: string;
  /** Apple WWDR intermediate certificate, base64 encoded (DER or PEM). */
  wwdrBase64: string;
};

export type GoogleWalletConfig = {
  /** Numeric issuer ID from the Google Wallet Console. */
  issuerId: string;
  /** Service-account email (e.g. wallet@my-project.iam.gserviceaccount.com). */
  serviceAccountEmail: string;
  /** Service-account RSA private key (PEM). May contain literal \n escapes. */
  serviceAccountPrivateKey: string;
  /**
   * Class suffix used to build the full classId `${issuerId}.${classSuffix}`.
   * One class is created per app — defaults to `business_card`.
   */
  classSuffix: string;
};

export function getAppleWalletConfig(): AppleWalletConfig | null {
  const passTypeId = process.env.APPLE_PASS_TYPE_ID;
  const teamId = process.env.APPLE_TEAM_ID;
  const p12Base64 = process.env.APPLE_PASS_P12_BASE64;
  const p12Password = process.env.APPLE_PASS_P12_PASSWORD;
  const wwdrBase64 = process.env.APPLE_WWDR_BASE64;
  if (!passTypeId || !teamId || !p12Base64 || !p12Password || !wwdrBase64) {
    return null;
  }
  return { passTypeId, teamId, p12Base64, p12Password, wwdrBase64 };
}

export function getGoogleWalletConfig(): GoogleWalletConfig | null {
  const issuerId = process.env.GOOGLE_WALLET_ISSUER_ID;
  const serviceAccountEmail = process.env.GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL;
  const rawKey = process.env.GOOGLE_WALLET_SERVICE_ACCOUNT_PRIVATE_KEY;
  if (!issuerId || !serviceAccountEmail || !rawKey) return null;

  return {
    issuerId,
    serviceAccountEmail,
    // env vars often arrive with literal "\n" — normalise to real newlines
    serviceAccountPrivateKey: rawKey.replace(/\\n/g, "\n"),
    classSuffix: process.env.GOOGLE_WALLET_CLASS_SUFFIX || "business_card",
  };
}
