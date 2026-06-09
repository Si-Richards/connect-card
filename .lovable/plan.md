# Share vCard via Web Share API

Yes — modern browsers (iOS Safari, Android Chrome, most desktop Chromium) support sharing files through `navigator.share({ files: [...] })`. We can fetch the signed `.vcf` from `/api/public/vcard/:publicId` and hand it to the OS share sheet, so the recipient gets a real contact file they can open in Contacts/Phone/Mail directly — much nicer than sharing a link.

## Scope

Frontend-only change in `src/routes/c.$publicId.tsx`. No backend or business-logic changes — the existing signed vCard endpoint already returns the right `text/vcard` bytes.

## UX

Replace the current single "Share" icon button (which shares only the page URL) with a smarter share control that, in order of preference:

1. **Share the vCard file** — if `navigator.canShare({ files: [vcf] })` is true, call `navigator.share({ files: [vcf], title, text })`. This is the new primary path on iOS/Android.
2. **Share the link** — if file share isn't supported but `navigator.share` exists, fall back to `navigator.share({ title, url })` (current behaviour).
3. **Copy link** — if no Web Share at all, keep the existing "Copy link" button as the sole option.

The existing "Copy link" button stays as a secondary action on all platforms so users always have a way to grab the URL.

Button label: **"Share contact"** with the `Share2` icon. While the file is being fetched, show "Preparing…" to cover the network round-trip.

## Technical details

In `WalletButtons`' sibling area (the share row near the bottom of `CardPage`):

- Add a small helper that:
  - `fetch(vcfUrl)` → `blob()` → `new File([blob], '${slug-or-name}.vcf', { type: 'text/vcard' })`
  - Tests `navigator.canShare?.({ files: [file] })`
  - Calls `navigator.share(...)` and swallows `AbortError` (user cancelled).
- Replace the current `Share2` button's `onClick` with this helper.
- Keep the visibility guard: only render the share button if `"share" in navigator`. Copy-link button stays unconditional.
- Filename: use `${e.full_name.replace(/\s+/g, '-')}.vcf` for a friendly download name, falling back to `${e.public_id}.vcf`.
- No new dependencies. No changes to `selfhost/` or any route loader.

## Notes / caveats

- File sharing requires HTTPS (already the case in production).
- Desktop Safari and Firefox don't support `canShare({ files })` — they'll automatically fall through to URL share or copy-link.
- The vCard endpoint requires the signed token already present in `tokens.vcard`, so no auth changes.

## Out of scope

- Adding share for Apple/Google Wallet passes.
- QR-code image sharing.
- Any backend or analytics event for "shared" (can add later if you want a `share_click` event type).