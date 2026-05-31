import forge from "node-forge";
import { Buffer } from "node:buffer";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { env, appleWalletConfigured } from "../env.js";
import type { Employee, Branding } from "../routes/types.js";

export { appleWalletConfigured };

function hexToRgb(hex: string | null | undefined, fallback: string): string {
  const m = (hex ?? "").trim().match(/^#?([0-9a-fA-F]{6})$/);
  if (!m) return fallback;
  const n = parseInt(m[1], 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
}

async function loadLocalImage(
  url: string | null | undefined,
  size: number,
  options: { circle?: boolean } = {},
): Promise<Buffer | null> {
  if (!url) return null;
  try {
    const u = new URL(url, env.APP_ORIGIN);
    if (u.pathname.startsWith("/uploads/")) {
      const file = path.join(env.UPLOAD_DIR, path.basename(u.pathname));
      let img = sharp(await fs.readFile(file)).resize(size, size, {
        fit: options.circle ? "cover" : "contain",
        background: { r: 255, g: 255, b: 255, alpha: 0 },
      });
      if (options.circle) {
        const mask = Buffer.from(
          `<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#fff"/></svg>`,
        );
        img = img.composite([{ input: mask, blend: "dest-in" }]);
      }
      return await img.png().toBuffer();
    }
  } catch {
    return null;
  }
  return null;
}


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

function createPassJson(e: Employee, cardUrl: string, branding: Branding): Buffer {
  const bg = hexToRgb(branding.brand_color, "rgb(255, 102, 0)");
  return Buffer.from(
    JSON.stringify({
      formatVersion: 1,
      passTypeIdentifier: env.APPLE_PASS_TYPE_ID,
      teamIdentifier: env.APPLE_TEAM_ID,
      organizationName: branding.company_name ?? e.company ?? "Business Card",
      description: `${e.full_name} – Business Card`,
      serialNumber: e.id,
      backgroundColor: bg,
      foregroundColor: "rgb(255, 255, 255)",
      labelColor: "rgb(255, 255, 255)",
      logoText: branding.company_name ?? e.company ?? "",
      generic: {
        headerFields: [],
        secondaryFields: [{ key: "name", label: "Name", value: e.full_name }],
        auxiliaryFields: e.job_title
          ? [{ key: "position", label: "Position", value: e.job_title }]
          : [],
        backFields: [
          ...(e.office_phone ? [{ key: "office", label: "Office", value: e.office_phone }] : []),
          ...(e.mobile ? [{ key: "mobile", label: "Mobile", value: e.mobile }] : []),
          ...(e.email ? [{ key: "email", label: "Email", value: e.email }] : []),
          ...(e.address ? [{ key: "address", label: "Address", value: e.address }] : []),
          ...(e.website ? [{ key: "website", label: "Website", value: e.website }] : []),
          ...(e.linkedin ? [{ key: "linkedin", label: "LinkedIn", value: e.linkedin }] : []),
          ...(e.booking_url ? [{ key: "booking", label: "Book a meeting", value: e.booking_url }] : []),
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

export async function buildApplePass(e: Employee, cardUrl: string, branding: Branding): Promise<Buffer> {
  if (!appleWalletConfigured) throw new Error("Apple Wallet not configured");

  const certificates = loadPemMaterial();
  const { PKPass } = await import("passkit-generator");
  const photo = await loadLocalImage(e.photo_url, 180);
  const photo2x = await loadLocalImage(e.photo_url, 360);
  const logo = await loadLocalImage(branding.logo_url, 80);
  const logo2x = await loadLocalImage(branding.logo_url, 160);
  const pass = new PKPass(
    {
      "pass.json": createPassJson(e, cardUrl, branding),
      "icon.png": onePixelPng(),
      "icon@2x.png": onePixelPng(),
      ...(logo ? { "logo.png": logo } : {}),
      ...(logo2x ? { "logo@2x.png": logo2x } : {}),
      ...(photo ? { "thumbnail.png": photo } : {}),
      ...(photo2x ? { "thumbnail@2x.png": photo2x } : {}),
    },
    certificates,
  );

  return pass.getAsBuffer();
}