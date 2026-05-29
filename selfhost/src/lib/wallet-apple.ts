import forge from "node-forge";
import { env, appleWalletConfigured } from "../env.js";
import type { Employee } from "../routes/types.js";

export { appleWalletConfigured };

/**
 * Convert a PKCS#12 (.p12) buffer into PEM cert + PEM private key strings.
 * passkit-generator hands these straight to node-forge, which only accepts PEM.
 */
function p12ToPem(p12Base64: string, passphrase: string): { cert: string; key: string } {
  const der = forge.util.decode64(p12Base64);
  const asn1 = forge.asn1.fromDer(der);
  const p12 = forge.pkcs12.pkcs12FromAsn1(asn1, false, passphrase);

  // Extract cert (first non-CA certificate in the bag)
  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] ?? [];
  const certBag = certBags.find((b) => b.cert);
  if (!certBag?.cert) throw new Error("No certificate found in .p12 bundle");

  // Extract key — try both shrouded (encrypted) and plain key bags
  const keyBags =
    p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag] ??
    [];
  const plainKeyBags = p12.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag] ?? [];
  const keyBag = keyBags[0] ?? plainKeyBags[0];
  if (!keyBag?.key) throw new Error("No private key found in .p12 bundle");

  return {
    cert: forge.pki.certificateToPem(certBag.cert),
    key: forge.pki.privateKeyToPem(keyBag.key),
  };
}

/**
 * Accept WWDR as either PEM (starts with "-----BEGIN") or DER (.cer) and
 * normalize to PEM.
 */
function wwdrToPem(b64: string): string {
  const raw = Buffer.from(b64, "base64");
  const asText = raw.toString("utf8");
  if (asText.includes("-----BEGIN CERTIFICATE-----")) return asText;
  // DER → forge cert → PEM
  const asn1 = forge.asn1.fromDer(forge.util.createBuffer(raw.toString("binary")));
  const cert = forge.pki.certificateFromAsn1(asn1);
  return forge.pki.certificateToPem(cert);
}

export async function buildApplePass(e: Employee, cardUrl: string): Promise<Buffer> {
  if (!appleWalletConfigured) throw new Error("Apple Wallet not configured");
  if (!env.APPLE_PASS_P12_PASSWORD) {
    throw new Error(
      "APPLE_PASS_P12_PASSWORD is empty. passkit-generator requires a non-empty passphrase on the .p12. " +
        "Re-export your Pass Type ID certificate from Keychain with a password set, then update .env.",
    );
  }

  // Convert PKCS#12 → PEM up-front so passkit-generator / node-forge can parse it.
  let certPem: string;
  let keyPem: string;
  let wwdrPem: string;
  try {
    const { cert, key } = p12ToPem(env.APPLE_PASS_P12_BASE64, env.APPLE_PASS_P12_PASSWORD);
    certPem = cert;
    keyPem = key;
  } catch (err: any) {
    throw new Error(
      `Failed to parse APPLE_PASS_P12_BASE64 with the provided password: ${err?.message ?? err}. ` +
        "Check that APPLE_PASS_P12_BASE64 is the base64 of a valid .p12 and APPLE_PASS_P12_PASSWORD matches.",
    );
  }
  try {
    wwdrPem = wwdrToPem(env.APPLE_WWDR_BASE64);
  } catch (err: any) {
    throw new Error(
      `Failed to parse APPLE_WWDR_BASE64: ${err?.message ?? err}. ` +
        "Provide the WWDR certificate as base64 of either the .cer (DER) or the PEM-encoded cert.",
    );
  }

  // Lazy import so missing native deps don't crash boot when Wallet is unused.
  const { PKPass } = await import("passkit-generator");

  const pass = new PKPass(
    {},
    {
      wwdr: wwdrPem,
      signerCert: certPem,
      signerKey: keyPem,
      // Key is now a plain PEM (no passphrase) after extraction.
      signerKeyPassphrase: undefined as unknown as string,
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
