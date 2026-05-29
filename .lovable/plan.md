## Problem

Nginx error: `directory index of "/opt/connect-card/selfhost/dist/" is forbidden`

Two things are wrong:

1. **Wrong `root` path on the server.** The frontend (TanStack Start SPA) builds to `dist/` at the **repo root**, not inside `selfhost/`. `selfhost/` is the Express backend — it has no `dist/` with an `index.html`. So nginx is pointed at a directory that has no `index.html`, and since `autoindex` is off, it returns "directory index forbidden".
2. The committed `selfhost/business-card.nginx.conf` currently uses `/opt/connect-card/dist` which is also a guess — it only works if the repo is cloned to `/opt/connect-card` and built from the root.

## Fix

Update `selfhost/business-card.nginx.conf` so the `root` directive and the surrounding comments make it unambiguous where the SPA build output lives, and add a short note that `selfhost/dist` is **not** the right path.

### Changes to `selfhost/business-card.nginx.conf`

- Keep `root /opt/connect-card/dist;` (repo cloned to `/opt/connect-card`, built from repo root with `bun run build` → produces `dist/index.html`).
- Expand the `CHANGE ME` comment to explicitly say:
  - The path must be the directory that contains `index.html` from the **frontend** build (repo root `dist/`), not `selfhost/dist/`.
  - `selfhost/` only contains the Express API; it has no `dist/index.html`.
- Keep `index index.html;` (already present).
- No other changes to proxy blocks, gzip, caching, or security headers.

### Changes to `INSTALL.md`

Add one troubleshooting bullet:
- **`directory index ... is forbidden`** → nginx `root` points at a directory with no `index.html`. Verify `ls /opt/connect-card/dist/index.html` exists. If you pointed it at `selfhost/dist`, that is wrong — the SPA builds to `dist/` at the repo root, not inside `selfhost/`.

## What the user needs to do on the server

Either:
- **Option A (recommended):** fix the nginx `root` to point at the repo-root `dist/` (e.g. `/opt/connect-card/dist`), run `bun install && bun run build` from the repo root, then `nginx -t && systemctl reload nginx`.
- **Option B:** if they really want the build output under `selfhost/dist`, they need to actually build the frontend into that path (non-standard) — not recommended.

No source code, routes, or backend changes.
