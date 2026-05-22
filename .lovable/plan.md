# Enable "Add to Apple Wallet"

Right now the Apple Wallet button is intentionally disabled. The card page renders it greyed out with a tooltip — there's no backend route generating `.pkpass` files yet. That's because signed Apple Wallet passes require credentials from an Apple Developer account; without them, the file Apple Wallet accepts can't be produced.

## What Apple requires

To generate a valid `.pkpass`, we need all of these from your Apple Developer account ($99/year):

1. **Pass Type ID** (e.g. `pass.com.yourcompany.businesscard`) — created in the Apple Developer portal
2. **Pass Type ID certificate** (`.p12` file) — downloaded after creating the Pass Type ID, exported from Keychain with a password
3. **Apple WWDR G4 certificate** — public, downloaded from Apple
4. **Team Identifier** (10-character string from your developer account)

Without these, any `.pkpass` we generate will be rejected by iOS with "Pass cannot be installed".

## Plan

### 1. Backend: signed pass generation
- Add `passkit-generator` (or equivalent Worker-compatible library — will verify compatibility with the Cloudflare Worker runtime before installing; if it requires Node-only APIs, fall back to a hand-rolled signer using Web Crypto + a small ZIP lib)
- New server route: `GET /api/public/wallet/:slug` returning `application/vnd.apple.pkpass`
- Reads employee record, builds `pass.json` (generic pass style) with name, title, company, contacts, photo as thumbnail, QR/barcode pointing back to `/card/:slug`
- Signs manifest with your `.p12` cert
- Stores certs as runtime secrets: `APPLE_PASS_P12_BASE64`, `APPLE_PASS_P12_PASSWORD`, `APPLE_PASS_TYPE_ID`, `APPLE_TEAM_ID`, `APPLE_WWDR_BASE64`

### 2. Frontend
- Enable the existing "Add to Apple Wallet" button on `/card/:slug`
- Link to `/api/public/wallet/:slug`
- Show the button only on iOS user agents (on other platforms it's not useful); keep vCard download as the universal fallback

### 3. Graceful fallback
- If the Apple secrets aren't configured, the endpoint returns 503 and the frontend hides the button — so the app keeps working even before you upload the cert

## What I need from you before building

1. Do you have (or are you willing to set up) an Apple Developer account + Pass Type ID? If **no**, the honest answer is Apple Wallet isn't achievable — I'd remove the button instead. Google Wallet is a cheaper alternative (no $99 fee, simpler signing) if cross-platform "wallet" is the real goal.
2. If **yes**, you'll need to upload 4 secrets once you have the cert. I'll request them via the secrets prompt when we get to that step.

Want me to proceed assuming you'll set up an Apple Developer account, or pivot to Google Wallet / just remove the button?
