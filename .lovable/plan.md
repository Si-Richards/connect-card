# Fix: Google Wallet "something went wrong"

## Root cause

You configured the env vars but never created the **GenericClass** in Google Wallet. When the backend signs a save-to-wallet JWT, it references `GOOGLE_WALLET_CLASS_ID`. Google's save endpoint looks that class up in your issuer account, doesn't find it, and shows a generic "something went wrong" instead of a useful error. Nothing is wrong with the code, the issuer approval, or the image URLs — the class simply has to exist before any object can reference it, and it only needs to be created **once per environment**.

## What I'll add

A one-shot CLI script in the self-hosted backend that uses the service-account credentials already in your env vars to create (or update) the class via the Google Wallet REST API.

### New file: `selfhost/src/scripts/create-google-wallet-class.ts`

- Reads `GOOGLE_WALLET_ISSUER_ID`, `GOOGLE_WALLET_CLASS_ID`, and `GOOGLE_WALLET_SERVICE_ACCOUNT_JSON_BASE64` from env (re-using `selfhost/src/env.ts`).
- Validates `GOOGLE_WALLET_CLASS_ID` starts with `{issuerId}.` and refuses to continue otherwise (the most common copy/paste mistake).
- Mints a short-lived OAuth access token from the service account JSON (RS256 JWT → `https://oauth2.googleapis.com/token`, scope `https://www.googleapis.com/auth/wallet_object.issuer`).
- `GET https://walletobjects.googleapis.com/walletobjects/v1/genericClass/{classId}`:
  - `200` → class already exists, print "OK, nothing to do" and exit 0.
  - `404` → `POST .../genericClass` with a minimal body (`id`, `classTemplateInfo` left at defaults). On success print "Created".
  - Anything else → print Google's error body verbatim and exit 1, so configuration mistakes are diagnosable.
- No new dependencies — `jsonwebtoken` is already in `selfhost/package.json` for the save-URL signing flow, and `fetch` is built in.

### `selfhost/package.json`

Add a script entry so the operator runs it as a normal npm command:

```json
"wallet:create-google-class": "tsx src/scripts/create-google-wallet-class.ts"
```

### `INSTALL.md` (Google Wallet section)

Replace the "create the class with curl" paragraph with:

```bash
cd /opt/connect-card/selfhost
sudo -u bcuser npm run wallet:create-google-class
```

Note that the script is idempotent and safe to re-run.

## What you'll do on the VPS afterwards

```bash
cd /opt/connect-card/selfhost
git pull
npm install            # no new deps, but keeps lockfile consistent
npm run build
sudo -u bcuser npm run wallet:create-google-class
sudo systemctl restart business-card
```

Then reload a card page, tap **Add to Google Wallet**, and it should open the standard preview screen.

## If it still fails after the class is created

The script prints Google's exact error body, which will tell us which of the remaining edge cases it is — almost always one of:

- `GOOGLE_WALLET_CLASS_ID` is not prefixed with your issuer ID (e.g. `cardkit_v1` instead of `3388000000012345678.cardkit_v1`).
- Service-account email isn't linked under **Users** in the Google Pay & Wallet Console for that issuer.
- Wallet API not enabled on the Google Cloud project the service account belongs to.

We can address whichever the script surfaces in a follow-up.

## Out of scope

- No changes to `selfhost/src/lib/wallet-google.ts`, the save-URL flow, the QR code, or the SPA. The pass payload is already valid — it just has nowhere to anchor until the class exists.
- No changes to Apple Wallet, the public card route, or analytics.
