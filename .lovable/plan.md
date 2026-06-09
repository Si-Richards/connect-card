# Apple Wallet Pass — Native Share (AirDrop)

Add a share button next to the existing Apple Wallet button in `src/routes/c.$publicId.tsx` that uses the Web Share API to share the `.pkpass` file. On iOS/macOS Safari this surfaces AirDrop, Messages, Mail, etc. automatically.

## Behavior

1. Render share button only when `navigator.share` exists (feature-detect on mount to avoid SSR mismatch).
2. On tap:
   - Fetch `/api/public/wallet/:publicId` → blob
   - Wrap blob in `new File([blob], "${fullName}.pkpass", { type: "application/vnd.apple.pkpass" })`
   - If `navigator.canShare?.({ files: [file] })` → `navigator.share({ files: [file], title: "${fullName} — Apple Wallet pass" })`
   - Else fallback: `navigator.share({ title, url: signedPassUrl })`
3. Loading state: button shows spinner + "Preparing…" while fetching.
4. Swallow `AbortError` (user cancelled). Surface other errors via existing toast.

## Scope

- Frontend-only change in `src/routes/c.$publicId.tsx` (and the `WalletButtons` component already receiving `fullName`).
- No backend, no new routes, no new deps.
- Google Wallet share remains skipped.