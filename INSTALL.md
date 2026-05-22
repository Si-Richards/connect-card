# Installation

This app is built and hosted on **Lovable Cloud** (managed Supabase + Cloudflare
Workers). The instructions below cover both the standard Lovable workflow and a
from-scratch self-host on your own Supabase project.

---

## Option A — Run on Lovable (recommended)

1. Open the project in Lovable. The backend (database, auth, storage) is
   provisioned automatically — no `.env` to manage.
2. Click **Publish** to deploy. Your app is live at
   `https://<project>.lovable.app`.
3. Create the first admin (one-time):
   - Sign up via `/login` with the email/password you want to use.
   - In Lovable, open **Cloud → Database** and run:
     ```sql
     INSERT INTO public.user_roles (user_id, role)
     VALUES ((SELECT id FROM auth.users WHERE email = 'you@example.com'), 'admin');
     ```
4. (Optional) Enable Apple Wallet passes: see **Apple Wallet** below.

That's it — visit `/admin` to manage employees.

---

## Option B — Self-host on your own Supabase project

### 1. Prerequisites

- Node 20+ and `bun` (or `npm`/`pnpm`)
- A Supabase project (free tier is fine)
- A storage bucket named `employee-photos` (public read)

### 2. Clone and install

```bash
git clone <repo>
cd <repo>
bun install
```

### 3. Apply the database schema

In the Supabase SQL editor, run [`schema.sql`](./schema.sql) end to end.
It creates:

- `app_role` enum (`admin`, `moderator`, `user`)
- `profiles`, `user_roles`, `employees`, `company_settings`, `employee_events`
- `has_role(uuid, app_role)` security-definer function
- `increment_employee_views(text)` RPC
- All RLS policies

### 4. Environment

Create `.env` with your Supabase project values:

```bash
VITE_SUPABASE_URL="https://<project-ref>.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="<anon-key>"
VITE_SUPABASE_PROJECT_ID="<project-ref>"

# Server-only
SUPABASE_URL="https://<project-ref>.supabase.co"
SUPABASE_PUBLISHABLE_KEY="<anon-key>"
SUPABASE_SERVICE_ROLE_KEY="<service-role-key>"
```

### 5. Auth setup

In Supabase **Auth → Providers**, enable Email. Either turn on email
confirmation or pre-confirm your first user manually. Sign up at `/login`, then
seed the admin role (same SQL as in Option A, step 3).

### 6. Run

```bash
bun run dev          # local dev server
bun run build        # production build
bun run start        # serve the build
```

### 7. Apple Wallet (optional)

Add these runtime secrets (Lovable: **Cloud → Secrets**; self-host: `.env`):

| Key | Value |
| --- | --- |
| `APPLE_PASS_TYPE_ID` | e.g. `pass.co.uk.voicehost.businesscard` |
| `APPLE_TEAM_ID` | your 10-char Apple developer team ID |
| `APPLE_PASS_CERT_PEM` | Pass Type ID certificate (PEM) |
| `APPLE_PASS_KEY_PEM` | Private key (PEM) |
| `APPLE_PASS_KEY_PASSWORD` | Key passphrase (optional) |
| `APPLE_WWDR_PEM` | Apple WWDR intermediate cert (PEM) |

Without these, `/api/public/wallet/<slug>` returns `503` and the "Add to
Apple Wallet" button shows as unavailable.

---

## Using analytics

- Every view of `/card/<slug>` records a `view` event from the browser.
- QR codes encode `/card/<slug>?src=qr`, so opens from a scanned code are
  recorded as `scan` events.
- The admin list shows 30-day view + scan totals per employee.
- The employee edit page shows a 30-day stacked daily chart and the 25 most
  recent events (source, referrer, user-agent).
- All events live in `public.employee_events`. Admins can query directly, e.g.:
  ```sql
  SELECT date_trunc('day', occurred_at) AS day,
         event_type, count(*)
  FROM public.employee_events
  WHERE employee_id = '<uuid>'
    AND occurred_at > now() - interval '90 days'
  GROUP BY 1, 2 ORDER BY 1 DESC;
  ```

## Troubleshooting

- **"Admin access required"** after signing in — you haven't been granted the
  `admin` role yet. Run the `INSERT INTO user_roles` snippet above.
- **QR/Wallet returns 503** — the underlying generator failed (often missing
  Apple certs or a malformed slug). Check `/api/public/errors` and server logs.
- **Analytics columns show 0** — events are written from the *browser*, so
  ad-blockers or `prefetch` may suppress them. Open the card in a real tab.
