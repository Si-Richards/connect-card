import forge from "node-forge";
import { Buffer } from "node:buffer";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { env, appleWalletConfigured } from "../env.js";
import type { Employee } from "../routes/types.js";

export { appleWalletConfigured };

type PemMaterial = {
  signerCert: string;
  signerKey: string;
  wwdr: string;
};

function cleanBase64(value: string): string {
  return value.replace(/\s+/g, "");
}

function certificateToPemFromBase64(name: string, b64: string): string {
  const raw = Buffer.from(cleanBase64(b64), "base64");
  const asText = raw.toString("utf8");

  if (asText.includes("-----BEGIN CERTIFICATE-----")) {
    return asText.match(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/)?.[0] ?? asText;
  }

  try {
    const der = forge.util.createBuffer(raw.toString("binary"));
    return forge.pki.certificateToPem(forge.pki.certificateFromAsn1(forge.asn1.fromDer(der)));
  } catch (err: any) {
    throw new Error(`${name} must be base64 of a PEM or DER certificate: ${err?.message ?? err}`);
  }
}

function p12ToPem(p12Base64: string, passphrase: string): { signerCert: string; signerKey: string } {
  try {
    const der = forge.util.decode64(cleanBase64(p12Base64));
    const p12 = forge.pkcs12.pkcs12FromAsn1(forge.asn1.fromDer(der), false, passphrase);

    const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] ?? [];
    const keyBags = [
      ...(p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag] ?? []),
      ...(p12.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag] ?? []),
    ];

    const cert = certBags.find((bag) => bag.cert)?.cert;
    const key = keyBags.find((bag) => bag.key)?.key;

    if (!cert) throw new Error("No certificate found in .p12 bundle");
    if (!key) throw new Error("No private key found in .p12 bundle");

    return {
      signerCert: forge.pki.certificateToPem(cert),
      signerKey: forge.pki.privateKeyToPem(key),
    };
  } catch (err: any) {
    throw new Error(
      `Failed to parse APPLE_PASS_P12_BASE64 with APPLE_PASS_P12_PASSWORD: ${err?.message ?? err}. ` +
        "Check that APPLE_PASS_P12_BASE64 is base64 of a valid .p12 and that the password matches.",
    );
  }
}

function loadPemMaterial(): PemMaterial {
  if (!env.APPLE_PASS_P12_PASSWORD) {
    throw new Error(
      "APPLE_PASS_P12_PASSWORD is empty. Re-export the Pass Type ID .p12 with a password and update .env.",
    );
  }

  const { signerCert, signerKey } = p12ToPem(env.APPLE_PASS_P12_BASE64, env.APPLE_PASS_P12_PASSWORD);
  const wwdr = certificateToPemFromBase64("APPLE_WWDR_BASE64", env.APPLE_WWDR_BASE64);

  for (const [name, value] of Object.entries({ signerCert, signerKey, wwdr })) {
    if (!value.includes("-----BEGIN")) throw new Error(`${name} was not converted to PEM`);
  }

  return { signerCert, signerKey, wwdr };
}

function createPassJson(e: Employee, cardUrl: string): Buffer {
  return Buffer.from(
    JSON.stringify({
      formatVersion: 1,
      passTypeIdentifier: env.APPLE_PASS_TYPE_ID,
      teamIdentifier: env.APPLE_TEAM_ID,
      organizationName: e.company ?? "Business Card",
      description: `${e.full_name} – Business Card`,
      serialNumber: e.id,
      backgroundColor: "rgb(255, 102, 0)",
      foregroundColor: "rgb(255, 255, 255)",
      labelColor: "rgb(255, 255, 255)",
      generic: {
        headerFields: e.company
          ? [{ key: "company", label: "Company", value: e.company }]
          : [],
        secondaryFields: [{ key: "name", label: "Name", value: e.full_name }],
        auxiliaryFields: e.job_title
          ? [{ key: "position", label: "Position", value: e.job_title }]
          : [],
        backFields: [
          ...(e.office_phone ? [{ key: "office", label: "Office", value: e.office_phone }] : []),
          ...(e.website ? [{ key: "website", label: "Website", value: e.website }] : []),
          ...(e.linkedin ? [{ key: "linkedin", label: "LinkedIn", value: e.linkedin }] : []),
        ],
      },
      barcodes: [
        {
          message: cardUrl,
          format: "PKBarcodeFormatQR",
          messageEncoding: "iso-8859-1",
        },
      ],
    }),
  );
}

function onePixelPng(): Buffer {
  return Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
    "base64",
  );
}

async function employeePhotoPng(e: Employee, size: number): Promise<Buffer | null> {
  if (!e.photo_url) return null;
  try {
    const url = new URL(e.photo_url, env.APP_ORIGIN);
    if (url.pathname.startsWith("/uploads/")) {
      const file = path.join(env.UPLOAD_DIR, path.basename(url.pathname));
      return await sharp(await fs.readFile(file)).resize(size, size, { fit: "cover" }).png().toBuffer();
    }
  } catch {
    return null;
  }
  return null;
}

export async function buildApplePass(e: Employee, cardUrl: string): Promise<Buffer> {
  if (!appleWalletConfigured) throw new Error("Apple Wallet not configured");

  const certificates = loadPemMaterial();
  const { PKPass } = await import("passkit-generator");
  const photo = await employeePhotoPng(e, 180);
  const photo2x = await employeePhotoPng(e, 360);
  const pass = new PKPass(
    {
      "pass.json": createPassJson(e, cardUrl),
      "icon.png": onePixelPng(),
      "icon@2x.png": onePixelPng(),
      ...(photo ? { "thumbnail.png": photo } : {}),
      ...(photo2x ? { "thumbnail@2x.png": photo2x } : {}),
    },
    certificates,
  );

  return pass.getAsBuffer();
}