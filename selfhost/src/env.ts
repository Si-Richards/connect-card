import "dotenv/config";

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export const env = {
  DATABASE_URL: required("DATABASE_URL"),
  APP_ORIGIN: process.env.APP_ORIGIN ?? "http://localhost:5173",
  UPLOAD_DIR: process.env.UPLOAD_DIR ?? "/var/lib/business-card/uploads",
  PORT: Number(process.env.PORT ?? 3000),
  SESSION_SECRET: required("SESSION_SECRET"),

  APPLE_PASS_TYPE_ID: process.env.APPLE_PASS_TYPE_ID ?? "",
  APPLE_TEAM_ID: process.env.APPLE_TEAM_ID ?? "",
  APPLE_PASS_P12_BASE64: process.env.APPLE_PASS_P12_BASE64 ?? "",
  APPLE_PASS_P12_PASSWORD: process.env.APPLE_PASS_P12_PASSWORD ?? "",
  APPLE_WWDR_BASE64: process.env.APPLE_WWDR_BASE64 ?? "",

  GOOGLE_WALLET_ISSUER_ID: process.env.GOOGLE_WALLET_ISSUER_ID ?? "",
  GOOGLE_WALLET_CLASS_ID: process.env.GOOGLE_WALLET_CLASS_ID ?? "",
  GOOGLE_WALLET_SERVICE_ACCOUNT_JSON_BASE64:
    process.env.GOOGLE_WALLET_SERVICE_ACCOUNT_JSON_BASE64 ?? "",
};

export const appleWalletConfigured =
  !!env.APPLE_PASS_TYPE_ID &&
  !!env.APPLE_TEAM_ID &&
  !!env.APPLE_PASS_P12_BASE64 &&
  !!env.APPLE_PASS_P12_PASSWORD &&
  !!env.APPLE_WWDR_BASE64;

export const googleWalletConfigured =
  !!env.GOOGLE_WALLET_ISSUER_ID &&
  !!env.GOOGLE_WALLET_CLASS_ID &&
  !!env.GOOGLE_WALLET_SERVICE_ACCOUNT_JSON_BASE64;
