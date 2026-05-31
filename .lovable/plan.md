## Goal

Make employee cards unguessable. Anyone with the link (from a QR scan or shared by the cardholder) sees the card; nobody can enumerate cards by typing names into the URL bar.

## How it works

Today: `/card/rick-deckard` — guessable, scrapeable by slug.
After:  `/c/8fK2_aQ7vP9xL3nR` — 128 bits of entropy, unguessable.

The QR encodes the new opaque URL. The QR stays stable forever (no reprints). The cardholder's human-readable slug is kept internally for admin URLs (`/admin/employees/rick-deckard`) but is never exposed on the public card route.

## Changes

### 1. Database
- Add `public_id TEXT UNIQUE NOT NULL DEFAULT (encode(gen_random_bytes(12), 'base64'))` to `employees` (Lovable Cloud) and to the self-host MySQL schema.
- Backfill existing rows with random IDs.
- Keep `slug` for admin/internal use.

### 2. Public API (selfhost + Cloud)
- New route: `GET /api/public/cards/by-public-id/:publicId` — the only public read path.
- Deprecate `GET /api/public/cards/:slug` (return 404 to kill the enumeration vector). Admin reads keep using authenticated routes.
- Wallet/vCard signing tokens key off `public_id` instead of `slug`.

### 3. Frontend
- New route file `src/routes/c.$publicId.tsx` renders the card.
- Old `/card/:slug` route returns a not-found page (or 301 to the admin if logged-in).
- `<head>` keeps `noindex, nofollow` and adds an empty `og:` block so accidental shares to Slack/WhatsApp don't preview the card.

### 4. QR generation
- `qr-code.ts` (or wherever the QR PNG is built) generates the QR from `https://{APP_ORIGIN}/c/{public_id}`.
- Existing QRs that encoded `/card/:slug` stop working. A one-time admin action ("Regenerate QR codes for all employees") downloads a zip of new PNGs.

### 5. Defense in depth (kept from today)
- `X-Robots-Tag: noindex, nofollow` on the card response.
- `Cache-Control: private, no-store`.
- Bot user-agent block.
- Rate-limit `/api/public/cards/by-public-id/:publicId` to ~30 req/min/IP to make brute-forcing the 128-bit ID space pointless in practice as well as in theory.

## What this does NOT do

- Anyone the cardholder forwards the URL to can still view it (that's the point of a business card).
- It does not log who viewed; we can add view audit later if you want.
- Existing printed QR codes need to be reprinted once. After that, never again.

## Files touched

- `supabase/migrations/{ts}_employees_public_id.sql` — add column + backfill + index.
- `selfhost/migrations/{ts}_employees_public_id.sql` — same for MySQL.
- `selfhost/src/routes/public.ts` — new `by-public-id` handler, retire `:slug` handler.
- `selfhost/src/lib/wallet-apple.ts`, `wallet-google.ts`, `vcard.ts` — switch lookup key.
- `selfhost/src/lib/qr.ts` — new URL shape.
- `src/routes/c.$publicId.tsx` — new public card page.
- `src/routes/card.$slug.tsx` — delete or redirect.
- Admin employee detail page — show the new `/c/...` URL and a "copy link / download QR" button.

## Open question

Do you want me to also add a **view audit log** (timestamp + coarse IP / UA per view) so you can see when a card was opened? Not required for privacy, but pairs naturally with this change. I can include it or leave it out.
