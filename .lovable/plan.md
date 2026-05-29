## Goal

Make `bun run build` produce a normal SPA (`dist/index.html` + `dist/assets/...`) so the existing nginx config (`root /opt/connect-card/dist;`) just works. The Express API in `selfhost/` stays unchanged.

## Why this is feasible (small blast radius)

The runtime code is already SPA-shaped:

- `src/lib/employees.functions.ts` and `src/lib/analytics.functions.ts` are already thin client wrappers around `src/lib/api.ts` (fetch → Express). No real server functions.
- `src/router.tsx` already uses plain `@tanstack/react-router` (no Start APIs).
- Only Start-specific pieces are: `shellComponent` in `__root.tsx`, `src/start.ts`, `src/server.ts`, `wrangler.jsonc`, one server route (`src/routes/api/public/healthcheck.ts`), and the Vite config target.

## Changes

### 1. Build config — `vite.config.ts`

Replace `@lovable.dev/vite-tanstack-config` (which forces TanStack Start + Cloudflare Worker output) with a plain SPA config:

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { tanstackRouter } from "@tanstack/router-plugin/vite";

export default defineConfig({
  plugins: [
    tanstackRouter({ target: "react", autoCodeSplitting: true }),
    react(),
    tailwindcss(),
    tsconfigPaths(),
  ],
  build: { outDir: "dist" },
  server: { host: "::", port: 8080 },
});
```

`@tanstack/router-plugin` and `@vitejs/plugin-react` are already in `package.json`. No new deps needed.

### 2. SPA entrypoints

- Add **`index.html`** at repo root with `<div id="root"></div>` and `<script type="module" src="/src/main.tsx"></script>`. Include the existing `<meta>` tags from `__root.tsx`'s `head()` as a fallback (per-route `head()` won't run on the server anymore, so client-rendered meta is best-effort).
- Add **`src/main.tsx`**: bootstraps the router and mounts into `#root`:
  ```ts
  import { StrictMode } from "react";
  import { createRoot } from "react-dom/client";
  import { RouterProvider } from "@tanstack/react-router";
  import { getRouter } from "./router";
  import "./styles.css";
  createRoot(document.getElementById("root")!).render(
    <StrictMode><RouterProvider router={getRouter()} /></StrictMode>
  );
  ```

### 3. Root route — `src/routes/__root.tsx`

- Remove `shellComponent`, `RootShell`, `HeadContent`, `Scripts` imports.
- Keep `component: RootComponent` (QueryClientProvider + `<Outlet/>`) and the not-found / error boundaries.
- Drop the `head()` block (or keep but it becomes a no-op in SPA mode — moved to `index.html` instead).

### 4. Delete SSR / Worker plumbing

Remove these files (all SSR-only):
- `src/server.ts` — Worker entry wrapper
- `src/start.ts` — `createStart` middleware
- `wrangler.jsonc` — Cloudflare config
- `src/routes/api/public/healthcheck.ts` — server route (Express has its own health endpoint)
- `src/lib/error-capture.ts`, `src/lib/error-page.ts` — only used by the Worker entry (verify no other callers; the client `ErrorComponent` in `__root.tsx` doesn't use them)

The Supabase helper files (`auth-attacher.ts`, `auth-middleware.ts`, `client.server.ts`) are unused by any route — leave them in place (they're auto-generated and the prompt forbids editing them), they'll be tree-shaken out.

### 5. `package.json`

Remove deps that are no longer used: `@tanstack/react-start`, `@cloudflare/vite-plugin`, `@lovable.dev/vite-tanstack-config`. (Keep `@tanstack/react-router`, `@tanstack/router-plugin`, `@vitejs/plugin-react`, `@tailwindcss/vite`, `vite-tsconfig-paths`.)

Scripts stay as-is (`vite dev`, `vite build`, `vite preview`).

### 6. nginx + INSTALL.md

Revert to the original simple SPA layout:

- `selfhost/business-card.nginx.conf`: `root /opt/connect-card/dist;` (back to plain `dist/`, the parent split disappears).
- `INSTALL.md`: drop the `dist/client` / `dist/server` explanation; verification step becomes `ls /opt/connect-card/dist/index.html`; Caddy snippet reverts to `root * /opt/connect-card/dist`.
- Build command on the server becomes simply: `VITE_API_BASE_URL=/api bun install && bun run build`.

### 7. `.lovable/plan.md`

Update to record the SPA switch (no more SSR, no more Cloudflare target).

## Verification

1. `bun run build` produces `dist/index.html` + `dist/assets/*.js|css`.
2. `bun run preview` serves the SPA locally; `/`, `/login`, `/admin`, `/card/test-slug` all render (with API calls failing gracefully when the Express backend isn't running — that's expected in local preview).
3. On the VPS: `ls /opt/connect-card/dist/index.html` exists, `nginx -t && systemctl reload nginx`, and `https://card.example.com/` loads the SPA shell, with `/api/*` still going to Express on :3000.

## Heads-up / trade-offs

- **Goodbye SSR meta tags.** Per-route `head()` no longer renders on the server. Crawlers and social previews will only see the static tags in `index.html`. If you ever want rich per-card OG images for `/card/:slug`, you'd need either (a) a tiny pre-render step, or (b) have Express render an HTML shell with injected meta for that route. Out of scope here.
- **Deviation from the Lovable template.** This stack normally targets TanStack Start + Cloudflare Workers. Future Lovable template updates (e.g. `@lovable.dev/vite-tanstack-config` bumps) won't apply cleanly. That's a deliberate cost of self-hosting on plain nginx.
- **`build:dev`** keeps working because it's still just `vite build --mode development`.
