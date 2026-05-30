import jwt from "jsonwebtoken";
import { env, googleWalletConfigured } from "../env.js";
import type { Employee, Branding } from "../routes/types.js";

export { googleWalletConfigured };

function publicImageUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  try {
    const parsed = new URL(url, env.APP_ORIGIN);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return undefined;
    return parsed.toString();
  } catch {
    return undefined;
  }
}

function normalizeHex(hex: string | null | undefined, fallback: string): string {
  const m = (hex ?? "").trim().match(/^#?([0-9a-fA-F]{6})$/);
  return m ? `#${m[1].toLowerCase()}` : fallback;
}

export function buildGoogleWalletSaveUrl(
  e: Employee,
  cardUrl: string,
  branding: Branding,
): string {
  if (!googleWalletConfigured) throw new Error("Google Wallet not configured");
  const sa = JSON.parse(
    Buffer.from(env.GOOGLE_WALLET_SERVICE_ACCOUNT_JSON_BASE64, "base64").toString("utf8"),
  ) as { client_email: string; private_key: string };

  const objectId = `${env.GOOGLE_WALLET_ISSUER_ID}.${e.id.replace(/-/g, "")}`;
  const photoUrl = publicImageUrl(e.photo_url);
  const logoUrl = publicImageUrl(branding.logo_url);

  const textModulesData = [
    ...(e.address ? [{ id: "address", header: "Address", body: e.address }] : []),
    ...(e.booking_url ? [{ id: "booking", header: "Book a meeting", body: e.booking_url }] : []),
  ];

  const genericObject: any = {
    id: objectId,
    classId: env.GOOGLE_WALLET_CLASS_ID,
    cardTitle: {
      defaultValue: { language: "en", value: branding.company_name ?? e.company ?? "Business Card" },
    },
    header: { defaultValue: { language: "en", value: e.full_name } },
    subheader: e.job_title
      ? { defaultValue: { language: "en", value: e.job_title } }
      : undefined,
    textModulesData: textModulesData.length ? textModulesData : undefined,
    imageModulesData: photoUrl
      ? [{ mainImage: { sourceUri: { uri: photoUrl }, contentDescription: { defaultValue: { language: "en", value: `${e.full_name} photo` } } } }]
      : undefined,
    barcode: { type: "QR_CODE", value: cardUrl },
    hexBackgroundColor: normalizeHex(branding.brand_color, "#ff6600"),
    logo: logoUrl
      ? {
          sourceUri: { uri: logoUrl },
          contentDescription: {
            defaultValue: { language: "en", value: branding.company_name ?? "Logo" },
          },
        }
      : undefined,
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
