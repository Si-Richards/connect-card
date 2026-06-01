## Problem

QR codes and public links encode `${APP_ORIGIN}/c/<public_id>`. `APP_ORIGIN` in `selfhost/.env` on the server is still `https://softphone.voicehost.io`, so every newly generated QR points at the dead test domain.

Old printed QR codes that were generated before the migration cannot be retargeted — the URL is physically printed. They must be re-printed from a freshly generated QR (or, if needed, a redirect from the old host to the new one set up at the DNS/proxy layer — out of scope here unless you want it).

## Changes

### 1. Server env (one-time op on the VPS)

Edit `/opt/connect-card/selfhost/.env` (or wherever the service's EnvironmentFile lives — `business-card.service` references `/opt/business-card/selfhost/.env`, confirm the actual path):

```
APP_ORIGIN=https://cardkit.voicehost.io
```

Then restart:

```bash
sudo systemctl restart business-card
```

After restart, every new QR and `/c/...` link is generated against the new origin. Verify by hitting `/api/employees/<id>/qr-url` or downloading a fresh QR PNG from the admin.

### 2. Docs / examples (repo)

Update the placeholder/example hostnames so future installs and the README don't keep referencing the old domain:

- `selfhost/.env.example` — change the `APP_ORIGIN=` example to `https://cardkit.voicehost.io` (or keep `card.example.com` as the generic placeholder — pick one; recommend keeping `card.example.com` to stay generic).
- `INSTALL.md` — same: leave `card.example.com` as the generic example, OR replace with `cardkit.voicehost.io` if you want this repo's docs to reflect your specific deployment.
- `selfhost/business-card.nginx.conf` — same call on `server_name card.example.com;`.

Recommended: keep the docs/examples generic (`card.example.com`) — the only real fix is the production `.env` on the server.

### 3. Nginx server_name (server-side, if not already)

On the VPS, make sure the nginx (or Caddy) `server_name` matches `cardkit.voicehost.io` and that TLS is issued for that host. If old `softphone.voicehost.io` should redirect, add a second server block that 301s to `https://cardkit.voicehost.io$request_uri` so old printed QRs still resolve.

## Out of scope

- No code changes in the app are required — `APP_ORIGIN` is already the single source of truth for QR/link generation (`selfhost/src/routes/public.ts` builds `cardUrl()` from `env.APP_ORIGIN`, and `selfhost/src/lib/qr.ts` reads the same).
- Apple/Google Wallet passes encode the same URL — they'll pick up the new origin automatically after the restart.

## Question

Do you want me to also add an nginx redirect block from `softphone.voicehost.io` → `cardkit.voicehost.io` so previously printed QR codes keep working? (Requires either keeping the old DNS record + TLS cert, or that the old host already resolves to the same server.)
