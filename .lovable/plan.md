## Problem

`bun run build` on TanStack Start produces:
- `dist/client/` — static SPA assets including `index.html` (what nginx should serve)
- `dist/server/` — SSR bundle (Node/Worker code, not for nginx)

There is no `dist/index.html` at the top of `dist/`. The committed nginx config points `root` at `/opt/connect-card/dist`, which contains only those two subfolders — so nginx finds no `index.html` and returns "directory index forbidden".

## Fix

### `selfhost/business-card.nginx.conf`
- Change `root /opt/connect-card/dist;` → `root /opt/connect-card/dist/client;`
- Update the surrounding comment to explain that TanStack Start splits the build into `dist/client/` (static, served by nginx) and `dist/server/` (SSR bundle, ignored here since we're serving as a pure SPA).
- Keep everything else (gzip, cache, `/api` and `/uploads` proxies, SPA fallback, security headers) unchanged.

### `INSTALL.md`
- Section 3 (Frontend): update the verification step from `ls /opt/connect-card/dist/index.html` → `ls /opt/connect-card/dist/client/index.html`.
- Update the Caddy snippet `root * /opt/connect-card/dist` → `root * /opt/connect-card/dist/client`.
- Troubleshooting bullets: replace the "`dist/` at repo root" wording with the correct path `dist/client/`, and explicitly note that `dist/server/` is the SSR bundle and must not be the nginx root.

No source code, route, or backend changes.

## What the user does on the server

```bash
cd /opt/connect-card
VITE_API_BASE_URL=/api bun install && bun run build
ls dist/client/index.html        # must exist
sudo sed -i 's|/opt/connect-card/dist;|/opt/connect-card/dist/client;|' \
  /etc/nginx/sites-available/business-card
sudo nginx -t && sudo systemctl reload nginx
```
