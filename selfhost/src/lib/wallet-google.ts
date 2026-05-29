import jwt from "jsonwebtoken";
import { env, googleWalletConfigured } from "../env.js";
import type { Employee } from "../routes/types.js";

export { googleWalletConfigured };

export function buildGoogleWalletSaveUrl(e: Employee, cardUrl: string): string {
  if (!googleWalletConfigured) throw new Error("Google Wallet not configured");
  const sa = JSON.parse(
    Buffer.from(env.GOOGLE_WALLET_SERVICE_ACCOUNT_JSON_BASE64, "base64").toString("utf8"),
  ) as { client_email: string; private_key: string };

  const objectId = `${env.GOOGLE_WALLET_ISSUER_ID}.${e.id.replace(/-/g, "")}`;
  const genericObject = {
    id: objectId,
    classId: env.GOOGLE_WALLET_CLASS_ID,
    cardTitle: { defaultValue: { language: "en", value: e.company ?? "Business Card" } },
    header: { defaultValue: { language: "en", value: e.full_name } },
    subheader: e.job_title
      ? { defaultValue: { language: "en", value: e.job_title } }
      : undefined,
    barcode: { type: "QR_CODE", value: cardUrl },
    hexBackgroundColor: "#ff6600",
  };

  const claims = {
    iss: sa.client_email,
    aud: "google",
    typ: "savetowallet",
    iat: Math.floor(Date.now() / 1000),
    payload: { genericObjects: [genericObject] },
  };

  const token = jwt.sign(claims, sa.private_key, { algorithm: "RS256" });
  return `https://pay.google.com/gp/v/save/${token}`;
}
