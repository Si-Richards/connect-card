## Port MFA backend into the repo

The previous turn wrote backend files to a sandbox scratch path instead of `selfhost/` in this repo. Frontend changes (`src/lib/api.ts`, `src/routes/login.tsx`, `src/routes/_authenticated/admin.settings.tsx`) did land correctly. This plan adds the missing backend pieces to the repo so `git pull` on your VPS gets them.

### Files to create in the repo

1. **`selfhost/migrations/20260609_mfa.sql`** (renamed to match repo's date-prefixed convention) — idempotent migration:
   - `ALTER TABLE users ADD COLUMN mfa_secret_enc VARBINARY(512) NULL, ADD COLUMN mfa_enrolled_at TIMESTAMP NULL` (guarded by `information_schema` checks like the existing repair migration).
   - `CREATE TABLE user_mfa_recovery_codes (id CHAR(36) PK, user_id CHAR(36) FK → users ON DELETE CASCADE, code_hash VARCHAR(255), used_at TIMESTAMP NULL, created_at TIMESTAMP DEFAULT NOW(), INDEX(user_id))`.

2. **`selfhost/src/lib/mfa.ts`** — TOTP + recovery helpers:
   - AES-256-GCM `encryptSecret`/`decryptSecret`, key derived from `SESSION_SECRET` via HKDF-SHA256.
   - `generateTotpSecret`, `verifyTotpCode` (otplib, 1-step window).
   - `signMfaChallenge`/`consumeMfaChallenge` — short-lived JWT in `bc_mfa` httpOnly cookie (5 min, sameSite=lax), carries `userId`, `purpose: 'login'|'enroll'`, optional `pendingSecret`.
   - `generateRecoveryCodes()` → 10 plain + bcrypt hashes; `consumeRecoveryCode(userId, code)`.
   - In-memory rate limiter: 5 attempts / 10 min per challenge id.

3. **`selfhost/src/routes/auth.ts`** — updated endpoints (keeping existing `/me`, `/logout`):
   - `POST /auth/login` — password check only; sets `bc_mfa` cookie with `purpose: 'enroll'` (if `mfa_enrolled_at IS NULL`) or `'login'`; responds `{ next: 'enroll' | 'verify' }`. No session cookie yet.
   - `POST /auth/mfa/enroll/start` — requires `bc_mfa` (enroll); generates pending secret, re-signs cookie with `pendingSecret`, returns `{ otpauthUrl, secret }`.
   - `POST /auth/mfa/enroll/confirm` `{ code }` — verifies against pending secret; persists encrypted secret + `mfa_enrolled_at`; inserts 10 recovery code hashes; issues real session cookie; returns `{ recoveryCodes }`.
   - `POST /auth/mfa/verify` `{ code }` — accepts 6-digit TOTP or recovery code; on success clears `bc_mfa`, issues session cookie.
   - `POST /auth/mfa/recovery/regenerate` `{ password }` — authenticated; verifies password; replaces all rows in `user_mfa_recovery_codes` for user; returns 10 new codes.
   - `GET /auth/me` — extended to include `mfaEnrolled: boolean` and `mfaEnrolledAt`.

4. **`selfhost/package.json`** — add `"otplib": "^12.0.1"` to dependencies.

### Sandbox-only files to discard

`/mnt/documents/selfhost/...` was scratch — ignore. Only the in-repo files above ship.

### Deploy steps (unchanged from before)

```
cd /opt/connect-card && git pull
cd selfhost && npm install && npm run build
mysql connect_card < migrations/20260609_mfa.sql
systemctl restart business-card
```

Frontend SPA rebuild + reverse proxy reload as usual. Existing users with `mfa_enrolled_at IS NULL` are forced into enrolment on next login.

### Out of scope

TOTP only; no "remember this device"; no SMS/WebAuthn; no admin-side MFA reset UI (recoverable via the existing `npm run create-admin` password reset + DB delete of the user's secret if fully locked out — I can add an admin reset endpoint if you want).
