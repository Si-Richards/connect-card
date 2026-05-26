# Build the `selfhost/` Express + MySQL backend

The frontend (`src/lib/api.ts`) and `INSTALL.md` already document a backend at `selfhost/` that doesn't exist in the repo. That's why `npm run create-admin` fails. I'll create it as a self-contained Node 20 + Express + MySQL bundle that matches the exact endpoints, cookie auth, and schema the rest of the project assumes.

## What I'll create

```
selfhost/
  package.json               # scripts: dev, build, start, create-admin
  tsconfig.json
  .env.example
  business-card.service      # systemd unit
  src/
    index.ts                 # Express bootstrap, CORS, cookies, static /uploads, error handler
    db.ts                    # mysql2/promise pool from DATABASE_URL
    env.ts                   # typed env loader (dotenv)
    auth.ts                  # bcrypt + JWT (httpOnly cookie), requireAuth, requireAdmin
    routes/
      auth.ts                # POST /auth/login, /auth/logout, GET /auth/me
      employees.ts           # CRUD on /employees (admin)
      settings.ts            # GET/PATCH /settings (admin)
      uploads.ts             # POST /uploads (multer → UPLOAD_DIR, returns {url})
      analytics.ts           # GET /analytics/summary, /analytics/employees/:id
      public.ts              # GET /public/cards/:slug, POST /public/events,
                             # GET /public/vcard/:slug, /public/qr/:slug,
                             # GET /public/wallet/:slug, /public/google-wallet/:slug
    lib/
      vcard.ts               # build RFC vCard 3.0 string from employee
      qr.ts                  # PNG + SVG via `qrcode`
      wallet-apple.ts        # .pkpass via `passkit-generator` (501 if env unset)
      wallet-google.ts       # JWT save-link via google-auth-library (501 if env unset)
      events.ts              # insertEvent helper used by public download routes
    scripts/
      create-admin.ts        # CLI: upsert user + ensure admin role (idempotent)
```

## Endpoints (match `src/lib/api.ts` exactly)

Auth (cookie-based, `credentials: "include"`):
- `POST /api/auth/login` `{email,password}` → sets `session` httpOnly JWT cookie
- `POST /api/auth/logout`
- `GET /api/auth/me` → `{user:{id,email,isAdmin}}`

Admin (require admin role):
- `GET/POST /api/employees`, `GET/PATCH/DELETE /api/employees/:id`
- `GET/PATCH /api/settings`
- `POST /api/uploads` (multipart, `kind` ∈ employee-photo|company-asset)
- `GET /api/analytics/summary?days=N`
- `GET /api/analytics/employees/:id?days=N`

Public:
- `GET /api/public/cards/:slug` → `{employee, settings}`, 404 if missing/disabled
- `POST /api/public/events` (`view` | `scan`, hashed IP)
- `GET /api/public/vcard/:slug` → `text/vcard` + inserts `vcard_download` event
- `GET /api/public/qr/:slug?format=png|svg`
- `GET /api/public/wallet/:slug` → `.pkpass` (501 if Apple env unset) + `wallet_download` event
- `GET /api/public/google-wallet/:slug` → JWT redirect (501 if Google env unset) + `wallet_download` event

This closes the README's analytics caveat — `vcard_download` / `wallet_download` are inserted server-side before the file is returned.

## `create-admin` script (fixes the reported error)

```
npm run create-admin -- admin@example.com 'a-strong-password'
# or
ADMIN_EMAIL=... ADMIN_PASSWORD=... npm run create-admin
```

Behavior matches `INSTALL.md`:
- creates `users` row, or resets `password_hash` if the email already exists
- ensures `user_roles(user_id, 'admin')` (idempotent)
- requires `DATABASE_URL` from `selfhost/.env`, password ≥ 8 chars
- exits non-zero with a clear message on bad input

## Dependencies (selfhost only — separate `package.json`)

`express`, `cookie-parser`, `mysql2`, `bcryptjs`, `jsonwebtoken`, `multer`, `zod`, `dotenv`, `qrcode`, `uuid`, `cors`, `passkit-generator`, `google-auth-library`. Dev: `typescript`, `tsx`, `@types/*`.

Note: these run on the user's Node 20 VPS, not the Lovable Worker — native deps are fine.

## Security defaults

- bcrypt cost 12, JWT signed with `SESSION_SECRET` (added to `.env.example`, required at boot)
- Cookie: `httpOnly`, `sameSite=lax`, `secure` when `APP_ORIGIN` is https
- Zod validation on every request body / query / params
- `requireAdmin` middleware on every `/employees`, `/settings`, `/uploads`, `/analytics` route
- IP hashed with `SESSION_SECRET` salt before insert into `card_events`
- Multer: 5 MB limit, mime allowlist (`image/png|jpeg|webp|svg+xml`), random filename

## Docs

- Add `SESSION_SECRET` to `INSTALL.md` env block
- Note that `selfhost/.env` must exist before `create-admin` runs
- README "Re-enabling auth" section: mark as done, point at `selfhost/src/auth.ts`

## Out of scope

- Frontend changes (api.ts already matches)
- Apple/Google Wallet certificate provisioning (env-driven; endpoints return 501 until configured — matches existing INSTALL.md)
- Tests, Docker, multi-tenant
