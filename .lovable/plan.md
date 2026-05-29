## Problem

Two separate bugs:

1. **The server crashes** (not just the request fails) when someone clicks "Add to Apple Wallet". `buildApplePass()` throws synchronously inside `new PKPass(...)`, but the `/wallet/:slug` handler has no `try/catch`, so the rejection escapes Express and systemd restarts the process. That's why each click takes the API down.

2. **The actual passkit error**: `"signerKeyPassphrase" is not allowed to be empty`. Your `.env` has `APPLE_PASS_P12_PASSWORD=` (empty). `passkit-generator` requires a non-empty passphrase whenever you hand it a PKCS#12 (which we do — `APPLE_PASS_P12_BASE64` is used for both `signerCert` and `signerKey`). An empty string is rejected by its Joi schema.

## Fix

**A. `selfhost/src/routes/public.ts`** — wrap the wallet route in try/catch so a build error returns `500 <message>` to the browser instead of killing the Node process:

```ts
publicRouter.get("/wallet/:slug", async (req, res) => {
  if (!appleWalletConfigured) return res.status(501).send("Apple Wallet not configured");
  const emp = await loadActive(req.params.slug);
  if (!emp) return res.status(404).send("Not found");
  try {
    const buf = await buildApplePass(emp, cardUrl(emp.slug));
    await insertEvent(emp.id, "wallet_download", req);
    res.setHeader("Content-Type", "application/vnd.apple.pkpass");
    res.setHeader("Content-Disposition", `attachment; filename="${emp.slug}.pkpass"`);
    res.send(buf);
  } catch (err: any) {
    console.error("[apple-wallet] build failed:", err?.message ?? err);
    res.status(500).send(`Apple Wallet pass generation failed: ${err?.message ?? "unknown error"}`);
  }
});
```

Same defensive wrapper added to `/google-wallet/:slug`.

**B. `selfhost/src/lib/wallet-apple.ts`** — pre-flight check: if `APPLE_PASS_P12_PASSWORD` is empty, throw a clear error before calling `new PKPass(...)`:

```ts
if (!env.APPLE_PASS_P12_PASSWORD) {
  throw new Error(
    "APPLE_PASS_P12_PASSWORD is empty. passkit-generator requires a non-empty passphrase on the .p12. " +
    "Re-export your Pass Type ID certificate from Keychain with a password set, then update .env.",
  );
}
```

**C. `selfhost/src/env.ts`** — tighten `appleWalletConfigured` to also require `APPLE_PASS_P12_PASSWORD`, so the frontend button is hidden when the passphrase is missing instead of showing a button that 500s.

**D. `selfhost/.env.example` + `INSTALL.md`** — note that `APPLE_PASS_P12_PASSWORD` is **required**, not optional, and explain how to re-export the `.p12` from Keychain with a passphrase (Keychain → right-click the Pass Type ID cert → Export → set a password).

## What you need to do on the VPS

The certificate you currently exported has no passphrase. Apple's tooling and `passkit-generator` both require one. Two options:

- **Easiest**: open Keychain Access on the Mac that owns the Pass Type ID cert, right-click the cert (with its private key), Export as `.p12`, **set a password** in the export dialog, then on the VPS:
  ```bash
  base64 -w0 pass.p12 > pass.p12.b64
  ```
  Paste that into `APPLE_PASS_P12_BASE64` and put the password you chose into `APPLE_PASS_P12_PASSWORD`, then `systemctl restart business-card`.

- Or re-sign the existing key with a password:
  ```bash
  openssl pkcs12 -in pass.p12 -nodes -out tmp.pem -legacy
  openssl pkcs12 -export -in tmp.pem -out pass-pw.p12 -password pass:YOUR_PASSWORD
  rm tmp.pem
  ```

After the code change + new `.p12`, the wallet endpoint will either succeed or return a readable `500` — it will no longer crash the service.

## Out of scope (not changed)

- Splitting cert/key into separate PEMs — works today as long as the `.p12` has a password, so I'm leaving the current shape.
- Pass icons (`icon.png` etc.) — `passkit-generator` will warn but still build; if iOS rejects the pass after this fix, that's the next change to make.