# Share vCard + Apple Wallet pass via Web Share API

Modern browsers (iOS Safari, Android Chrome, most desktop Chromium) support sharing files through `navigator.share({ files: [...] })`. We use this for both the vCard and the Apple Wallet pass so recipients get real files (contact or pass) they can open directly in Contacts/Wallet.

## vCard share

Already implemented — fetch signed `.vcf` → `File` → `navigator.share({ files })`. Falls back to URL share on unsupported browsers.

## Apple Wallet pass share (new)

Add a small icon-only **share** button next to the existing "Add to Apple Wallet" button.

- Fetch `/api/public/wallet/:publicId` (`.pkpass`) as a blob, wrap it in `File` with type `application/vnd.apple.pkpass` and name `${full_name}.pkpass`.
- If `navigator.canShare({ files: [file] })` is true, share the file. On iOS/macOS Safari this opens the system share sheet with **AirDrop, Messages, Mail, etc.**
- If file share isn't supported, fall back to sharing the signed pass URL.
- Swallow `AbortError` (user cancelled share sheet).
- Show a brief loading state while the pass is being fetched.

## Scope

Frontend-only change in `src/routes/c.$publicId.tsx`.
- Update `WalletButtons` to accept `fullName` prop (needed for pass filename + share title).
- Add a sibling `onClick` share handler next to the Apple Wallet button (only when `available.apple && "share" in navigator`).
- No backend changes.

## Google Wallet

Skipped for now — Google Wallet passes are save-link URLs, not files, so AirDrop isn't relevant here. Can be added later if needed.
