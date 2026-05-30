
Implement steps 1–6 of the scraping-mitigation review. No edge/CDN work (step 7) and no app-level rate limiting.

## 1. Trim the public card payload

`selfhost/src/routes/public.ts` — in `GET /api/public/cards/:slug`, project the employee to a public DTO before responding:

Keep: `slug`, `full_name`, `job_title`, `company`, `email`, `office_phone`, `mobile`, `website`, `linkedin`, `address`, `photo_url`.
Drop: `notes`, `id`, `view_count`, `disabled`, `created_at`, `updated_at`.

(`/api/employees` admin routes stay unchanged — they keep returning the full row for the dashboard.)

## 2. Stop feeding harvesters via page metadata

`src/routes/card.$slug.tsx` `head()`:

- Remove `email` and `telephone` from the JSON-LD object.
- Always emit `{ name: "robots", content: "noindex, nofollow" }` for `/card/*` (drop the conditional that only sets it when disabled). Cards remain reachable by direct link / QR / wallet pass; they just don't get indexed.

`selfhost/src/routes/public.ts` — set response header `X-Robots-Tag: noindex, nofollow` on:
- `GET /api/public/cards/:slug`
- `GET /api/public/vcard/:slug`
- `GET /api/public/qr/:slug`
- `GET /api/public/wallet/:slug`
- `GET /api/public/google-wallet/:slug`

## 3. Make new slugs unguessable

`selfhost/src/routes/employees.ts` — in `POST /`, if the admin-supplied slug does not already end with a `-[a-z0-9]{6,}` suffix, append `-` plus 6 chars of `crypto.randomBytes(4).toString("base64url")` lowercased (strip non `[a-z0-9]`). Existing slugs are unaffected; old links keep working.

No frontend changes required — the admin UI already shows the resulting slug after save.

## 4. Cheap bot deterrents

`selfhost/src/routes/public.ts`:

- On `GET /api/public/cards/:slug`, `GET /api/public/vcard/:slug`, and `GET /api/public/wallet*/:slug`, set `Cache-Control: private, no-store`.
- Add a small `looksLikeBrowser(req)` helper: returns `false` when both `Accept` is missing/empty AND `User-Agent` is missing or matches `/(curl|wget|python-requests|httpie|go-http-client|libwww-perl)/i`. When it returns `false`, respond `403`. Apply to the same three endpoints above. Real browsers always send `Accept`, so this won't affect users.
- On `POST /api/public/events`, additionally drop (return `{ ok: false }` without inserting) when the `Referer` header is present but its origin doesn't match `env.APP_ORIGIN`. Missing Referer is allowed (privacy modes).

## 5. Signed, short-lived URLs for vCard + wallet

New helper `selfhost/src/lib/signed-url.ts`:
- `signResource(slug, kind, ttlSec=600)` → returns `{ exp, sig }` where `sig = hmacSha256(SESSION_SECRET, ${kind}:${slug}:${exp}).slice(0,32)`.
- `verifyResource(slug, kind, exp, sig)` → constant-time compare, reject if expired.

`selfhost/src/routes/public.ts`:
- In `GET /api/public/cards/:slug`, attach a `tokens` object to the response: `{ vcard: {exp, sig}, apple: {...}, google: {...} }` (each minted for its own kind).
- In `GET /api/public/vcard/:slug`, `GET /api/public/wallet/:slug`, `GET /api/public/google-wallet/:slug`: require `?exp=&sig=` query params and verify with `verifyResource`. On failure return `403`. (`/qr/:slug` stays open — the QR encodes the public card URL, not contact data.)

`src/lib/api.ts` — extend the `getEmployeeBySlug` response type with optional `tokens`.

`src/routes/card.$slug.tsx`:
- Build `vcfUrl`, `appleUrl`, `googleUrl` from `loaderData.tokens` (e.g. `/api/public/vcard/${slug}?exp=${t.exp}&sig=${t.sig}`).
- Pass tokens into `<WalletButtons />` as props (replace the current hardcoded URLs).

Tokens TTL = 10 min — long enough for the user to click Save, short enough to be useless for batch scraping.

## 6. robots.txt

Create `public/robots.txt`:

```
User-agent: *
Disallow: /card/
Disallow: /api/
Allow: /
```

Keeps the marketing site (root + future pages) indexable while excluding the card pages and API by default.

## Out of scope (per your call)

- No nginx / Cloudflare rate limiting (step 7).
- No app-level rate limiting.
- No CAPTCHA on the card page.

## Deploy

After merging, on the VPS:

```bash
cd /opt/connect-card && bun install && bun run build
cd /opt/connect-card/selfhost && npm install && npm run build
sudo systemctl restart business-card
```
