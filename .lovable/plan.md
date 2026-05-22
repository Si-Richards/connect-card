# Virtual Business Card App

A multi-user digital business card system with admin management, public card pages, QR sharing, vCard download, and Apple Wallet passes.

## Scope

### Public side
- `/card/:slug` — mobile-first public card page with photo, name, title, company, contact info
- Action buttons: Download vCard (.vcf), Add to Apple Wallet, Email, Call office, Call mobile, Visit website
- Disabled cards show a friendly "no longer available" message

### Admin side (auth-protected)
- `/login` — email/password sign-in
- `/admin` — list of employees with search, status toggle, view/copy link, QR download
- `/admin/employees/new` and `/admin/employees/:id` — create/edit form with photo upload
- Role-gated: only users with `admin` role can access
- Per-employee QR code (download PNG/SVG) and copy-link button

### Employee fields
Full name, job title, company, email, office phone, mobile, website, photo, slug (auto from name, editable), optional LinkedIn, optional notes, disabled flag.

### Company settings
Logo and brand color applied to public cards.

## Technical Plan

**Stack:** TanStack Start + Lovable Cloud (Supabase) for DB, auth, storage.

**Database tables:**
- `profiles` — links to `auth.users`, holds display name
- `user_roles` — separate roles table (`admin` enum) with `has_role()` security-definer function
- `employees` — all card fields + `slug` (unique) + `disabled` boolean + `created_by`
- `company_settings` — single-row table for logo URL and brand color
- `card_views` — log of public page hits and QR scans (for analytics)

**Storage buckets:**
- `employee-photos` (public)
- `company-assets` (public)

**RLS:**
- Public SELECT on `employees` where `disabled = false` (only safe columns exposed via a view or selected columns server-side)
- Admin-only INSERT/UPDATE/DELETE via `has_role(auth.uid(), 'admin')`

**Server functions / routes:**
- `GET /api/public/vcard/:slug` — returns `.vcf` with correct MIME
- `GET /api/public/wallet/:slug` — returns `.pkpass` (Apple Wallet)
- `GET /api/public/qr/:slug.(png|svg)` — QR image
- `createServerFn` wrappers for admin CRUD

**Libraries:** `qrcode` for QR generation, `passkit-generator` (or equivalent) for Apple Wallet passes, `zod` for validation.

## Apple Wallet — important note

Generating signed `.pkpass` files requires an **Apple Developer Pass Type ID certificate** (`.p12` file + password + team ID + pass type identifier). You'll need to:
1. Enroll in the Apple Developer Program ($99/year)
2. Create a Pass Type ID and download the certificate
3. Provide the cert + password as secrets

Until those are added, the Apple Wallet button will be shown but disabled with a tooltip. Everything else (vCard, QR, sharing) works without it.

## Nice-to-haves (in-scope)
- Logo + brand color settings
- Copy link button, QR PNG/SVG download
- Editable custom slug, LinkedIn field, notes field in vCard
- Basic view/scan counter on admin list

## Deferred
- CSV bulk import (can add after core works)
- Detailed analytics dashboard beyond simple counts

## Questions before building
1. **First admin account** — should I seed the first signed-up user as admin automatically, or do you want to specify an email?
2. **Apple Wallet** — proceed now with button disabled until you provide the Apple cert, or skip the Wallet feature entirely for v1?
3. **Branding** — any specific company name, logo, or brand color to use as defaults, or leave generic and configurable in settings?