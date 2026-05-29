# Fix the "service running but no frontend" 404

## Diagnosis

Two issues in `/mnt/documents/business-card.nginx.conf`:

1. **Wrong document root.** Config uses `/opt/business-card/dist`, but your install is at `/opt/connect-card`. If `dist/index.html` isn't at the configured path, every request returns 404.
2. **`/card/*` is wrongly proxied to Express.** The public card page is a SPA route (`src/routes/card.$slug.tsx`) — it must be served by `index.html`, not forwarded to Node. The Express backend only owns `/api/*` and `/uploads/*`.

There's also a prerequisite to confirm: the SPA build (`VITE_API_BASE_URL=/api bun run build`) must have actually produced `dist/index.html`.

## Changes

### 1. Update `/mnt/documents/business-card.nginx.conf`

- Change `root` to match the real install path (default to `/opt/connect-card/dist`, callout to edit if different).
- **Remove** the `location /card/ { ... }` block entirely so card URLs hit the SPA fallback.
- Keep `/api/` and `/uploads/` proxies to `127.0.0.1:3000`.
- Keep `try_files $uri $uri/ /index.html;` for SPA fallback.

### 2. Update `INSTALL.md`

- Make the build step explicit and unambiguous:
  ```
  cd /opt/connect-card
  bun install
  VITE_API_BASE_URL=/api bun run build
  ```
- Note that the nginx `root` must point at the resulting `dist/` directory.
- Update the Caddy example to also drop the `/card/*` handler (same bug).

## Verification steps for the user

After editing nginx and reloading:

```
ls /opt/connect-card/dist/index.html        # must exist
sudo nginx -t && sudo systemctl reload nginx
curl -I https://card.example.com/           # 200, text/html
curl -I https://card.example.com/card/test  # 200, text/html (SPA, not 404)
curl     https://card.example.com/api/public/healthcheck   # {"ok":true}
```

If `dist/index.html` is missing, the build didn't run — re-run the build command above before touching nginx again.
