
## Plan: Address all 6 next moves from the review

### 1. Re-enable admin auth end-to-end
- Create `src/routes/login.tsx` — email/password form posting to backend `/api/auth/login`, stores JWT in localStorage, redirects to `/admin`.
- Rewrite `src/routes/_authenticated/route.tsx` with a real `beforeLoad` guard: check for stored JWT, verify via `/api/auth/me`, redirect to `/login` if missing/invalid. Add logout button in header.
- Update `src/lib/api.ts` fetch helper to attach `Authorization: Bearer <token>` header on all admin requests and to throw on 401 (triggering redirect).
- Restore `requireAdmin` middleware on `selfhost/server/routes/upload.ts` `POST /` route.
- Replace hardcoded `checkIsAdmin()` with a real handler that returns `{ isAdmin: true }` only when `req.user` exists and has admin role.

### 2. Fix `admin.$id.tsx` analytics panel
- Read `vcards` and `wallets` from the new `/api/analytics/employees/:id` response and render alongside views/scans in the KPI row.
- Replace the broken `r.source` column in the recent-events table with `r.user_agent` (truncated) and show the proper event type label for all 4 types.

### 3. Build company settings admin page
- Create `src/routes/_authenticated/admin.settings.tsx` with a form for `company_name`, `brand_color` (color picker), `logo_url` (with upload via existing `/api/upload`).
- Load current settings via `GET /api/settings`, save via `PATCH /api/settings`.
- Add "Settings" link to the admin header in `_authenticated/route.tsx`.

### 4. Delete dead Supabase integration
- Remove `@supabase/supabase-js` from `package.json`.
- Delete unused files under `src/integrations/supabase/` that aren't auto-managed and aren't referenced anywhere in `src/`.
- Verify no remaining imports via grep before deleting.

### 5. Add Zod validation + basic rate-limiting on `/api/public/events`
- Install `zod` in `selfhost/` and validate the event payload (event_type enum, slug format/length, optional source/user_agent length caps).
- Add a simple in-memory IP+slug rate limiter (e.g. 30 events / minute / IP) in `selfhost/server/routes/public.ts` for the events endpoint only. Reject with 429 on overflow.
- Note: this is ad-hoc per the no-backend-rate-limiting directive, but the user explicitly asked for it.

### 6. Polish
- Update `src/routes/__root.tsx` (or index `head()`) to replace "Lovable App" title/description with CardKit branding.
- Move `passkit-generator`, `node-forge`, `qrcode` from root `package.json` dependencies to `selfhost/package.json` (they're only used server-side).
- Refactor `admin.analytics.tsx` recharts colors to use CSS variables from `src/styles.css` (`hsl(var(--primary))` etc.) instead of hardcoded hex.

### Out of scope (explicitly skipping)
- Deleting one of the two `schema.sql` files — needs user decision on canonical location.
- Removing the unreachable `src/routes/api/public/{errors,healthcheck}.ts` — harmless and may be useful if SSR mode is re-enabled.
- `INSTALL.md` `/login` reference — will be valid once step 1 lands.

### Technical notes
- Backend changes live in `selfhost/` and require user rebuild/redeploy to take effect; I'll note this clearly at the end.
- Auth flow uses the existing bcrypt+JWT scaffolding already in `selfhost/server/`; no new auth library needed.
- No database migrations required.
