# Apply review fixes

Frontend-only changes (plus one backend note for the user). No DB migrations.

## 1. Delete dead Supabase integration

- Delete `src/integrations/supabase/` (all 5 files: `auth-attacher.ts`, `auth-middleware.ts`, `client.server.ts`, `client.ts`, `types.ts`).
- Remove `@supabase/supabase-js` from `package.json` dependencies.
- Verify no remaining imports with `rg "integrations/supabase|@supabase/supabase-js" src`.

## 2. Remove the public errors dump endpoint

- Delete `src/routes/api/public/errors.ts` (publicly accessible internal error dump — security risk).
- Delete the now-unused `src/lib/error-capture.ts` if nothing else imports it (check first).

## 3. Move auth gate into `beforeLoad`

Rewrite `src/routes/_authenticated/route.tsx`:
- Add `beforeLoad` that calls `api.me()` via the router's `queryClient` (`ensureQueryData`), throws `redirect({ to: "/login", search: { redirect: location.href } })` on 401/403 or non-admin.
- Component reads the cached user via `useSuspenseQuery` (or `useQuery` with `initialData`) — no more `useEffect` redirects, no flash.

Wire `queryClient` into the router context (already present per `__root.tsx`'s `createRootRouteWithContext<{ queryClient: QueryClient }>`).

Drop redundant `checkIsAdmin` calls:
- `src/routes/_authenticated/admin.index.tsx`: remove `adminQ` + `adminFn`, run `employees`/`analytics` queries unconditionally (layout already gates).
- `src/routes/_authenticated/admin.analytics.tsx`: same — remove `adminQ` and `enabled: enabled` gating.
- `src/lib/employees.functions.ts`: keep `checkIsAdmin` export (used elsewhere) or remove if no callers remain after the refactor.

## 4. Unify chart + stat colors on design tokens

In `src/routes/_authenticated/admin.analytics.tsx`:
- `StatCard` `tone` prop: replace `bg-blue-100 text-blue-700` etc. with semantic tints driven by `--chart-1..4`. Use inline `style={{ background: "color-mix(in oklab, var(--chart-N) 15%, transparent)", color: "var(--chart-N)" }}` so dark mode works.
- Employee-detail `AreaChart`: replace hardcoded `#3b82f6` / `#10b981` / `#f59e0b` / `#8b5cf6` with `var(--chart-1..4)` (matching the summary chart) and reuse the same gradient defs pattern.
- Fix `Tooltip` `contentStyle` that uses `hsl(var(--card))` → `var(--card)` (tokens are oklch, not hsl).

In `src/routes/_authenticated/admin.$id.tsx` `AnalyticsPanel`:
- Replace `bg-primary/30`, `bg-amber-500/70`, `bg-violet-500/70` swatches/bars with inline styles using `var(--chart-1..4)` at matching opacities.
- Update the legend swatches likewise.

Confirm `src/styles.css` defines `--chart-1..4` (it ships with the template). If missing, add 4 oklch values in `:root` + `.dark`.

## 5. Verify backend records vCard / Wallet events

Add a short note to `README.md` under "Features" (or to `INSTALL.md` in the analytics section) stating that the selfhost endpoints `/api/public/vcard/:slug`, `/api/public/wallet/:slug`, `/api/public/google-wallet/:slug` MUST insert a `vcard_download` / `wallet_download` event row before returning — otherwise the analytics columns stay at zero.

This is documentation only; the actual code change lives in the (separate) `selfhost/` repo and can't be edited from here.

## Out of scope

- The SSR absolute-URL issue on `card.$slug.tsx` loader (#6 in review) — leave for a follow-up since it requires either marking the route client-only or adding a `getRequestOrigin` server fn, both of which are larger changes.
- `__root.tsx` SEO polish (canonical, twitter:image mirror) — separate small task.
- The missing `selfhost/` directory — informational, no code change.

## Validation

- `rg "supabase" src` returns nothing.
- `rg "checkIsAdmin" src` shows only the (kept or removed) library + any intentional callers.
- Build passes (harness runs it).
- Visual check of `/admin/analytics` in light + dark mode: both charts and all 4 stat cards use chart token colors.
