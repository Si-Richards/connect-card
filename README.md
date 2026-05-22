# Business Card

Self-hosted digital business card app. React (TanStack Start) front-end backed by an Express + MySQL API with local-disk file storage.

## Architecture

```
Browser ──► TanStack Start SPA ──► Express REST API (/api/*) ──► MySQL 8
                                              │
                                              └─► local disk (UPLOAD_DIR)
```

- **Frontend**: TanStack Start (React 19, Vite 7, Tailwind v4). Calls the backend via `src/lib/api.ts` (base URL = `VITE_API_BASE_URL`, default `/api`).
- **Backend**: Node 20 Express bundle in [`selfhost/`](./INSTALL.md) — serves REST endpoints, QR/vCard/Wallet generators, and `/uploads/*`.
- **Database**: MySQL 8. Schema in [`schema.sql`](./schema.sql).
- **Auth**: currently disabled. The admin UI at `/admin` is open. Add JWT/cookie auth in the Express layer before exposing publicly.

## Features

- Public card pages at `/card/:slug` with vCard download and QR
- Admin CRUD for employees and company branding
- Apple Wallet (`.pkpass`) and Google Wallet pass generation (backend handles signing)
- Scan/view analytics per employee

> **Analytics note:** The frontend records `view` and `scan` events from `/card/:slug`. The selfhost backend MUST record `vcard_download` and `wallet_download` events server-side from `/api/public/vcard/:slug`, `/api/public/wallet/:slug`, and `/api/public/google-wallet/:slug` (insert an `events` row before returning the file). Otherwise the vCard and Wallet analytics columns will always be zero.

## Local development

```bash
# 1. Backend (see INSTALL.md for full setup)
cd selfhost && npm ci && npm run dev   # API on :3000

# 2. Frontend (this repo)
bun install
VITE_API_BASE_URL=http://localhost:3000/api bun dev
```

Then open `http://localhost:5173`.

## Deployment

See [INSTALL.md](./INSTALL.md) for the full single-VPS install (MySQL + Node + systemd + Caddy).

## Re-enabling auth

The admin section was intentionally left open during the cloud → self-host migration. To lock it down:

1. Add an `/api/auth/login` endpoint in the Express bundle (bcrypt + JWT cookie).
2. Wrap admin endpoints with a `requireAdmin` middleware.
3. Restore an `_authenticated` route guard in `src/routes/_authenticated/route.tsx` that calls `/api/auth/me` and redirects on 401.
