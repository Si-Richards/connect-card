# Installation — Self-Hosted (Node + MySQL)

Single-VPS install. Ubuntu/Debian assumed; adapt paths for other distros.

## Requirements

- Linux server with systemd
- Node 20+ and npm (or bun)
- MySQL 8.x
- A writable upload directory (e.g. `/var/lib/business-card/uploads`)
- Optional: nginx or Caddy for TLS termination

## 1. Database

```bash
sudo mysql -e "CREATE DATABASE business_card CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
sudo mysql -e "CREATE USER 'bcuser'@'localhost' IDENTIFIED BY 'CHANGE_ME';"
sudo mysql -e "GRANT ALL ON business_card.* TO 'bcuser'@'localhost';"
mysql -u bcuser -p business_card < schema.sql
```

The schema lives in [`schema.sql`](./schema.sql) at the repo root.

## 1b. Bootstrap the first admin user

The admin dashboard is gated by the `admin` role in the `user_roles` table. Run the bootstrap script once after applying the schema so you can sign in immediately:

```bash
cd /opt/business-card/selfhost
# Either pass on the CLI…
npm run create-admin -- admin@example.com 'a-strong-password'

# …or via env vars (handy for CI / first-boot scripts)
ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD='a-strong-password' npm run create-admin
```

The script:
- creates the `users` row (or **resets the password** if the email already exists — also use this to recover from a lockout)
- guarantees the `admin` row in `user_roles` (idempotent, safe to re-run on every deploy)
- requires `DATABASE_URL` from `selfhost/.env`, and a password of at least 8 chars

Sign in at `https://card.example.com/login` with that email and you'll land on `/admin`.

## 2. Backend (Express API)

The Express bundle lives in `selfhost/`.

```bash
cd /opt/business-card/selfhost
npm ci
npm run build
```

### Environment

Create `selfhost/.env`:

```
DATABASE_URL=mysql://bcuser:CHANGE_ME@localhost:3306/business_card
APP_ORIGIN=https://card.example.com
UPLOAD_DIR=/var/lib/business-card/uploads
PORT=3000

# Required — signs JWT session cookies and salts IP hashes. Use a long random string.
SESSION_SECRET=replace-with-a-long-random-string

# Apple Wallet (optional)
APPLE_PASS_TYPE_ID=pass.com.example.businesscard
APPLE_TEAM_ID=XXXXXXXXXX
APPLE_PASS_P12_BASE64=...
APPLE_PASS_P12_PASSWORD=...
APPLE_WWDR_BASE64=...

# Google Wallet (optional)
GOOGLE_WALLET_ISSUER_ID=...
GOOGLE_WALLET_CLASS_ID=...
GOOGLE_WALLET_SERVICE_ACCOUNT_JSON_BASE64=...
```

```bash
sudo mkdir -p /var/lib/business-card/uploads
sudo chown -R www-data:www-data /var/lib/business-card
```

## 3. Frontend (TanStack Start SPA)

From the project root (e.g. `/opt/connect-card`):

```bash
cd /opt/connect-card
bun install
VITE_API_BASE_URL=/api bun run build
```

The build writes the static site to `dist/client/` and the SSR bundle to `dist/server/`. Nginx must serve `dist/client/` (it contains `index.html`); `dist/server/` is the Worker/SSR code and is not for nginx. Confirm `dist/client/index.html` exists before configuring the reverse proxy — if it's missing, the build didn't run and every URL returns 404 from nginx. Serve `dist/client/` from the same origin as the API (keeps `/api` relative and avoids CORS); only `/api` and `/uploads` are proxied to Node — `/card/:slug` is a SPA route and must be served by `index.html`.

## 4. systemd

Copy `selfhost/business-card.service` to `/etc/systemd/system/`:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now business-card
journalctl -u business-card -f
```

## 5. Reverse proxy

### nginx

A ready-to-edit config is provided at `business-card.nginx.conf`. Update `server_name` and `root` (must point at your `dist/` directory) and drop it into `/etc/nginx/sites-available/`.

### Caddy

```
card.example.com {
  root * /opt/connect-card/dist/client
  encode gzip

  handle /api/* { reverse_proxy localhost:3000 }
  handle /uploads/* { reverse_proxy localhost:3000 }

  handle { try_files {path} /index.html; file_server }
}
```

Do NOT proxy `/card/*` to the backend — it's a SPA route served by `index.html`.

## 6. Auth (currently disabled)

The admin section is open in this build. Before going to production, add JWT auth in the Express layer and re-enable the `_authenticated` guard in the SPA. See the "Re-enabling auth" section in [README.md](./README.md).

## Troubleshooting

- **`directory index of "..." is forbidden`** — nginx `root` points at a directory with no `index.html`. The SPA builds to `dist/` at the **repo root** (e.g. `/opt/connect-card/dist`), NOT `selfhost/dist/` — `selfhost/` is the Express API and has no frontend build. Verify with `ls /opt/connect-card/dist/index.html`, fix the `root` directive, then `nginx -t && systemctl reload nginx`.
- **404 on `/` and `/card/...` but API works** — nginx `root` doesn't match where you built. Run `ls /opt/connect-card/dist/index.html`; if missing, re-run `VITE_API_BASE_URL=/api bun run build` from the repo root. If present, fix the `root` directive and `nginx -t && systemctl reload nginx`.
- **`/card/:slug` returns 404 but `/` works** — you're proxying `/card/*` to Express. Remove that handler; `/card/*` is a SPA route.
- **`/api/*` returns HTML** — your reverse proxy isn't forwarding `/api`. Check the `location /api/` (nginx) or `handle /api/*` (Caddy) block.
- **Uploads 404 after restart** — `UPLOAD_DIR` must be persistent and writable by the Node user.
- **Wallet endpoints 501** — the corresponding `APPLE_*` or `GOOGLE_*` env vars are unset. Wallet support is opt-in.
