import QRCode from "qrcode";
import sharp from "sharp";
import fs from "node:fs/promises";
import path from "node:path";
import { env } from "../env.js";

export async function qrSvg(url: string): Promise<string> {
  return QRCode.toString(url, { type: "svg", width: 512, margin: 1, errorCorrectionLevel: "H" });
}

/**
 * Generate a QR PNG. If logoUrl is provided (and resolvable from local /uploads/
 * or a fetchable http(s) URL), composite the logo on a white rounded square in
 * the center using high error-correction QR.
 */
export async function qrPng(url: string, logoUrl?: string | null): Promise<Buffer> {
  const size = 512;
  const qr = await QRCode.toBuffer(url, {
    type: "png",
    width: size,
    margin: 1,
    errorCorrectionLevel: "H",
  });

  if (!logoUrl) return qr;

  const logoBuf = await loadLogo(logoUrl);
  if (!logoBuf) return qr;

  const badge = Math.round(size * 0.24);
  const padded = Math.round(badge * 1.18);

  const resizedLogo = await sharp(logoBuf)
    .resize(badge, badge, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .png()
    .toBuffer();

  const radius = Math.round(padded * 0.18);
  const bgSvg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${padded}" height="${padded}">
       <rect width="${padded}" height="${padded}" rx="${radius}" ry="${radius}" fill="white"/>
     </svg>`,
  );
  const bg = await sharp(bgSvg).png().toBuffer();

  return sharp(qr)
    .composite([
      { input: bg, gravity: "center" },
      { input: resizedLogo, gravity: "center" },
    ])
    .png()
    .toBuffer();
}

async function loadLogo(logoUrl: string): Promise<Buffer | null> {
  try {
    const u = new URL(logoUrl, env.APP_ORIGIN);
    if (u.pathname.startsWith("/uploads/")) {
      const file = path.join(env.UPLOAD_DIR, path.basename(u.pathname));
      return await fs.readFile(file);
    }
    if (u.protocol === "http:" || u.protocol === "https:") {
      const res = await fetch(u.toString());
      if (!res.ok) return null;
      const ab = await res.arrayBuffer();
      return Buffer.from(ab);
    }
  } catch {
    return null;
  }
  return null;
}
