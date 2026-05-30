# Branding, White-label QR & Booking Link

Three features. Apple Wallet auto-update is skipped per your choice.

---

## 1. Company branding (global + per-employee overrides)

### Schema (MySQL — `schema.sql` + new migration `selfhost/migrations/`)

`company_settings` — add:
- `cover_image_url VARCHAR(512) NULL`
- `accent_color VARCHAR(16) NULL` (secondary brand color)

`employees` — add nullable overrides:
- `brand_color VARCHAR(16) NULL`
- `accent_color VARCHAR(16) NULL`
- `logo_url VARCHAR(512) NULL`
- `cover_image_url VARCHAR(512) NULL`

Effective branding = `employee.* ?? company_settings.*`. Resolved once on the server in `GET /api/public/cards/:slug` and returned as a `branding` object.

### Backend (`selfhost/src/routes/`)

- `public.ts` — extend `toPublicCard` payload with `branding: { logo_url, cover_image_url, brand_color, accent_color, company_name }`.
- `employees.ts` — accept the four new override fields in create/update Zod schema; trim+validate hex colors and URLs.
- `settings.ts` — accept `cover_image_url`, `accent_color`.
- `uploads.ts` — already handles images; reuse the `company-asset` and `employee-photo` kinds.

### Frontend

- `src/lib/api.ts` & `src/lib/employees.schema.ts` — add the new fields.
- `src/routes/_authenticated/admin.settings.tsx` — add cover image upload + accent color picker.
- `src/routes/_authenticated/admin.new.tsx` (and `admin.$id.tsx`) — new "Branding overrides" collapsible section with logo upload, cover upload, brand color, accent color (all optional, empty = use company default).
- `src/routes/card.$slug.tsx` — read `branding` from the API response and apply:
  - cover image as hero background
  - resolved brand color as CSS var (replaces hard-coded orange / current company color)
  - logo from `branding.logo_url`
  - company name from `branding.company_name`

### Wallet passes

- `selfhost/src/lib/wallet-apple.ts` & `wallet-google.ts` — accept the resolved `branding` and use `brand_color` for `backgroundColor` / hex theming, and the resolved logo where each format supports it (Apple `logo.png` strip, Google `logoUri`).

---

## 2. White-label QR code with logo in middle

### Backend

- `selfhost/src/lib/qr.ts` — switch from `qrcode` raw output to a composited PNG:
  1. Generate QR at high error-correction (`errorCorrectionLevel: 'H'`) so ~20% of modules can be obscured.
  2. Load company `logo_url` (from `company_settings`, resolved to a local `/uploads/...` path or fetched URL).
  3. Use `sharp` (already a dep via Apple wallet) to:
     - Render QR to PNG buffer
     - Resize logo to ~22% of QR size, add white rounded square padding behind it
     - Composite logo at center
  4. Return the buffer.
- Keep `qrSvg()` as plain (no logo) for fallback / print exports, OR generate SVG with embedded base64 logo. Default to PNG with logo for all card-facing QR usage.
- New route `GET /api/public/cards/:slug/qr.png` (signed token, same pattern as vCard/wallet) returns the branded PNG. Cache `Cache-Control: private, max-age=300`.

### Frontend

- `src/routes/card.$slug.tsx` — replace any client-side `qrcode` rendering with `<img src={qrUrl}>` pointing at the new signed endpoint.
- Apple/Google wallet pass generation continues using the raw URL in the barcode field (Wallet renders its own QR — branded QR is only for on-screen display & print).

---

## 3. Per-employee booking link (Calendly / Cal.com)

### Schema

`employees` — add:
- `booking_url VARCHAR(512) NULL`

### Backend

- `employees.ts` Zod schema — add `booking_url` with same URL validation pattern used for `website`/`linkedin`.
- `public.ts` `toPublicCard` — include `booking_url` in the public payload.
- `selfhost/src/lib/vcard.ts` — append booking_url as an additional `URL;type=Booking:` line so it shows up in saved contacts.
- `wallet-apple.ts` / `wallet-google.ts` — add to back fields as "Book a meeting".

### Frontend

- `src/lib/api.ts`, `employees.schema.ts` — add `booking_url`.
- `src/routes/_authenticated/admin.new.tsx` / `admin.$id.tsx` — new input "Booking link (Calendly / Cal.com)" with placeholder `https://cal.com/your-handle`.
- `src/routes/card.$slug.tsx` — when present, render a prominent **"Book a meeting"** CTA button (opens in new tab, tracked as a new `booking_click` event).
- `selfhost/src/lib/events.ts` + analytics — add `booking_click` to the event_type enum and analytics buckets.

---

## Technical details

### DB migrations
Two parallel migrations:
- `selfhost/migrations/202605XX_branding_overrides.sql` — adds `company_settings.cover_image_url`, `company_settings.accent_color`, and employee override columns.
- `selfhost/migrations/202605XX_booking_link.sql` — adds `employees.booking_url`, extends `card_events.event_type` enum with `booking_click`.

Update `schema.sql` to match (canonical reference).

### Signed QR endpoint
Reuse `signed-url.ts`. `getEmployeeBySlug` returns an additional `tokens.qr` entry; the SPA composes `/api/public/cards/:slug/qr.png?exp=&sig=`.

### Color tokens
On `card.$slug.tsx`, set `style={{ '--brand': branding.brand_color, '--brand-accent': branding.accent_color }}` on the root and reference via Tailwind arbitrary values (`bg-[var(--brand)]`). Falls back to design tokens when null.

### Files touched (summary)
- `schema.sql` + 2 new migration files
- `selfhost/src/routes/{public,employees,settings}.ts`
- `selfhost/src/routes/types.ts`
- `selfhost/src/lib/{qr,vcard,wallet-apple,wallet-google,events}.ts`
- `src/lib/api.ts`, `src/lib/employees.schema.ts`
- `src/routes/_authenticated/admin.{new,$id,settings}.tsx`
- `src/routes/card.$slug.tsx`

### Out of scope (per your answers)
- Apple Wallet APNs push / auto-update — skipped.
- Embedded Calendly widget and native availability slots — skipped; link-only.

### Deploy
```
cd /opt/connect-card && bun install && bun run build
cd /opt/connect-card/selfhost && npm install && npm run build
# run new migrations against MySQL
sudo systemctl restart business-card
```