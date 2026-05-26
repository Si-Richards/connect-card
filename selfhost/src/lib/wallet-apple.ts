import { env, appleWalletConfigured } from "../env.js";
import type { Employee } from "../routes/types.js";

export { appleWalletConfigured };

export async function buildApplePass(e: Employee, cardUrl: string): Promise<Buffer> {
  if (!appleWalletConfigured) throw new Error("Apple Wallet not configured");
  // Lazy import so missing native deps don't crash boot when Wallet is unused.
  const { PKPass } = await import("passkit-generator");

  const pass = new PKPass(
    {},
    {
      wwdr: Buffer.from(env.APPLE_WWDR_BASE64, "base64"),
      signerCert: Buffer.from(env.APPLE_PASS_P12_BASE64, "base64"),
      signerKey: Buffer.from(env.APPLE_PASS_P12_BASE64, "base64"),
      signerKeyPassphrase: env.APPLE_PASS_P12_PASSWORD,
    },
    {
      passTypeIdentifier: env.APPLE_PASS_TYPE_ID,
      teamIdentifier: env.APPLE_TEAM_ID,
      organizationName: e.company ?? "Business Card",
      description: `${e.full_name} – Business Card`,
      serialNumber: e.id,
      formatVersion: 1,
    },
  );

  pass.type = "generic";
  pass.primaryFields.push({ key: "name", label: "Name", value: e.full_name });
  if (e.job_title)
    pass.secondaryFields.push({ key: "title", label: "Title", value: e.job_title });
  if (e.company)
    pass.secondaryFields.push({ key: "company", label: "Company", value: e.company });
  if (e.email)
    pass.auxiliaryFields.push({ key: "email", label: "Email", value: e.email });
  if (e.mobile)
    pass.auxiliaryFields.push({ key: "mobile", label: "Mobile", value: e.mobile });

  pass.setBarcodes({
    message: cardUrl,
    format: "PKBarcodeFormatQR",
    messageEncoding: "iso-8859-1",
  });

  return pass.getAsBuffer();
}
