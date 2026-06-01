## Decision

No redirect from `/card/:slug` to `/c/:publicId`. The slug-resolver endpoint I proposed earlier is dropped — that would have leaked enumeration. The capability link lives in the admin only.

## What changes

### 1. Leave `/card/:slug` as a dead end
- `src/routes/card.$slug.tsx` keeps its current "This link has moved" notice (noindex, no fetch, no redirect).
- `selfhost/src/routes/public.ts` keeps the `GET /api/public/cards/:slug` → 404 stub. No slug→public_id lookup is added.

### 2. Make the `/c/:publicId` link first-class in admin
The admin employee detail page already shows the link, QR, copy button, open-card button, and revoke/reissue. Two small additions so admins can always find and share the link:

- **Admin list (`src/routes/_authenticated/admin.index.tsx`)**: add a small monospace "Link" column showing `/c/<public_id>` (truncated) next to the existing Slug column, with the existing Copy/Open/Download QR actions unchanged. This way admins see the real public URL at a glance, not just the internal slug.
- **Admin detail (`src/routes/_authenticated/admin.$id.tsx`)**: no functional change — the QR panel already shows the full URL, copy, open, download PNG/SVG, and revoke. Just relabel the section header from "QR code & public link" to "Public card link & QR" so it reads as the canonical place to grab the URL.

### 3. No backend changes
- No new endpoint.
- No DB migration.
- Wallet/vCard signing already keys off `public_id`.

## What this preserves

- Typing `/card/<anyone>` reveals nothing — no redirect, no 200, no slug-to-id oracle.
- The only way to reach a card is the unguessable `/c/:publicId` link, distributed via QR or by an admin copying it from the backend.
- Revoke & reissue still rotates `public_id` and invalidates old QRs/links.

## Files touched

- `src/routes/_authenticated/admin.index.tsx` — add Link column.
- `src/routes/_authenticated/admin.$id.tsx` — rename section header only.

Nothing else.
