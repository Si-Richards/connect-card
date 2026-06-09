## Required TOTP MFA — full implementation plan

### Backend (`/mnt/documents/selfhost/`)

**1. Schema migration** — new file `selfhost/migrations/002_mfa.sql`:
- `ALTER TABLE users ADD mfa_secret_enc VARBINARY(512) NULL, ADD mfa_enrolled_at TIMESTAMP NULL`.
- New `user_mfa_recovery_codes(id, user_id, code_hash, used_at)` — 10 bcrypt-hashed codes per user, each usable once.

**2. New helpers** `selfhost/server/lib/mfa.ts`:
- AES-256-GCM `encryptSecret` / `decryptSecret` using a key derived from `SESSION_SECRET` (HKDF-SHA256) — so the DB dump alone isn't enough to bypass MFA.
- `generateTotpSecret()`, `verifyTotpCode(secret, code)` via `otplib` (1-step window for clock drift).
- `signMfaChallenge({ userId, purpose: 'login'|'enroll', pendingSecret? })` — short-lived (5 min) JWT, separate cookie `bc_mfa` (httpOnly, sameSite=lax). `consumeMfaChallenge(req)` verifies + clears.
- `generateRecoveryCodes()` returns `{plain[10], hashes[10]}`; `consumeRecoveryCode(userId, code)`.

**3. Updated `selfhost/server/routes/auth.ts`** — endpoints:
- `POST /auth/login` — password verify. If `mfa_enrolled_at IS NULL`: set `bc_mfa` cookie with `purpose: 'enroll'` and respond `{ next: 'enroll' }`. Otherwise: set `bc_mfa` with `purpose: 'login'` and respond `{ next: 'verify' }`. **No session cookie issued yet.**
- `POST /auth/mfa/enroll/start` — requires `bc_mfa` (purpose enroll). Generate fresh TOTP secret, return `{ otpauthUrl, secret }` (secret shown to user so they can type-key it; pending secret stored inside a re-signed `bc_mfa` JWT — not in DB yet).
- `POST /auth/mfa/enroll/confirm` `{ code }` — verify code against pending secret in `bc_mfa`. On success: encrypt + persist `mfa_secret_enc`, set `mfa_enrolled_at = NOW()`, generate 10 recovery codes, persist hashes, issue real session cookie, respond `{ recoveryCodes: string[] }` (shown once).
- `POST /auth/mfa/verify` `{ code }` — requires `bc_mfa` (purpose login). Accept TOTP code OR a recovery code (try TOTP first; if 6 digits and fails, try recovery; mark used). On success: clear `bc_mfa`, set session cookie, respond `{ ok: true }`.
- `GET /auth/me` — unchanged response shape.

**4. Deps**: `bun add otplib` inside selfhost (no QR lib needed — SPA renders).

### Frontend (this repo)

**5. `src/lib/api.ts`** — add typed methods:
```
login(email, password) → { next: 'enroll' | 'verify' }
mfaEnrollStart() → { otpauthUrl, secret }
mfaEnrollConfirm(code) → { recoveryCodes: string[] }
mfaVerify(code) → { ok: true }
```
Return body of `login` is now consumed (was `{ok:true}`). 401 on `/auth/mfa/*` clears local UI state and bounces to `/login`.

**6. `src/routes/login.tsx`** — rewritten as a small state machine:
- step `'password'` → on success transition to step `'verify'` or `'enroll'`.
- step `'verify'` — 6-digit input (auto-focus, numeric inputMode, paste-friendly), "Use a recovery code instead" toggle (8-char alphanumeric), submits to `mfaVerify`.
- step `'enroll'` — renders QR (lightweight `qrcode` npm package → data URL via `toDataURL`) of `otpauthUrl`, shows secret in monospace, then 6-digit confirm input.
- step `'recovery-codes'` — shown immediately after enrolment confirm. Lists 10 codes, copy-all + download .txt buttons, single "I've saved these, continue" button → navigates to `redirect`.
- "Back to sign in" link at every MFA step clears the challenge by calling `api.logout()` (which also clears `bc_mfa`) and resets state.

**7. `src/routes/_authenticated/admin.settings.tsx`** — small "Two-factor authentication: Enabled since {date}" status row + "Regenerate recovery codes" button (calls a new `POST /auth/mfa/recovery/regenerate` — requires fresh password re-entry, returns 10 new codes; pragmatic addition, ~30 lines).

**8. Deps**: `bun add qrcode @types/qrcode` in this repo.

### Sequencing

1. Apply selfhost schema migration + ship server code + install otplib.
2. Existing users (already in DB) have `mfa_enrolled_at = NULL` → forced into enrolment on next login. No data loss, no admin reset needed.
3. Ship SPA changes. Until both sides are deployed together, login is broken — coordinate the deploy.

### Notes / out of scope

- TOTP only (no SMS, no WebAuthn) — matches your "Required for all users (TOTP app)" choice.
- "Remember this device for 30 days" is **not** included — every login requires a code. Tell me if you want it; it's ~40 lines (separate signed device cookie).
- Rate limiting: simple in-memory counter on `/auth/mfa/verify` (5 attempts / 10 min per challenge) inside the existing express app.
