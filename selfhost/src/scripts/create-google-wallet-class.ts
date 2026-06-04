/**
 * Idempotent helper: create the Google Wallet GenericClass referenced by
 * GOOGLE_WALLET_CLASS_ID, using the service account credentials in env.
 *
 * Run once per environment:
 *   npm run wallet:create-google-class
 *
 * Safe to re-run — exits 0 if the class already exists.
 */
import jwt from "jsonwebtoken";
import { env } from "../env.js";

const WALLET_API = "https://walletobjects.googleapis.com/walletobjects/v1";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/wallet_object.issuer";

async function main() {
  const issuerId = env.GOOGLE_WALLET_ISSUER_ID;
  const classId = env.GOOGLE_WALLET_CLASS_ID;
  const saB64 = env.GOOGLE_WALLET_SERVICE_ACCOUNT_JSON_BASE64;

  if (!issuerId || !classId || !saB64) {
    console.error(
      "Missing one of GOOGLE_WALLET_ISSUER_ID, GOOGLE_WALLET_CLASS_ID, GOOGLE_WALLET_SERVICE_ACCOUNT_JSON_BASE64",
    );
    process.exit(1);
  }

  if (!classId.startsWith(`${issuerId}.`)) {
    console.error(
      `GOOGLE_WALLET_CLASS_ID must be prefixed with the issuer ID.\n` +
        `  Expected: ${issuerId}.<suffix>\n` +
        `  Got:      ${classId}`,
    );
    process.exit(1);
  }

  const sa = JSON.parse(Buffer.from(saB64, "base64").toString("utf8")) as {
    client_email: string;
    private_key: string;
  };

  // 1. Mint an OAuth access token from the service account.
  const now = Math.floor(Date.now() / 1000);
  const assertion = jwt.sign(
    {
      iss: sa.client_email,
      scope: SCOPE,
      aud: TOKEN_URL,
      iat: now,
      exp: now + 3600,
    },
    sa.private_key,
    { algorithm: "RS256" },
  );

  const tokenRes = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  if (!tokenRes.ok) {
    console.error("Failed to obtain access token:", await tokenRes.text());
    process.exit(1);
  }
  const { access_token } = (await tokenRes.json()) as { access_token: string };

  const authHeader = { Authorization: `Bearer ${access_token}` };

  // 2. Does the class already exist?
  const getRes = await fetch(`${WALLET_API}/genericClass/${encodeURIComponent(classId)}`, {
    headers: authHeader,
  });

  if (getRes.status === 200) {
    console.log(`✓ Google Wallet class already exists: ${classId}`);
    return;
  }

  if (getRes.status !== 404) {
    console.error(`Unexpected GET response (${getRes.status}):`, await getRes.text());
    process.exit(1);
  }

  // 3. Create it.
  const createRes = await fetch(`${WALLET_API}/genericClass`, {
    method: "POST",
    headers: { ...authHeader, "Content-Type": "application/json" },
    body: JSON.stringify({ id: classId }),
  });

  if (!createRes.ok) {
    console.error(`Failed to create class (${createRes.status}):`, await createRes.text());
    process.exit(1);
  }

  console.log(`✓ Created Google Wallet class: ${classId}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
