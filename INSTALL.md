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

### 7. Wallet passes (optional)

All wallet env vars are read in **one place**: `src/lib/wallet-config.server.ts`.
Add new wallet credentials there if you extend this in future.

#### Apple Wallet

| Key | Value |
| --- | --- |
| `APPLE_PASS_TYPE_ID` | e.g. `pass.co.uk.voicehost.businesscard` |
| `APPLE_TEAM_ID` | your 10-char Apple developer team ID |
| `APPLE_PASS_P12_BASE64` | Pass Type ID `.p12` bundle, base64-encoded |
| `APPLE_PASS_P12_PASSWORD` | passphrase for the `.p12` |
| `APPLE_WWDR_BASE64` | Apple WWDR intermediate cert (DER or PEM), base64-encoded |

#### Google Wallet

1. In the [Google Wallet Console](https://pay.google.com/business/console/), create
   an Issuer account and note its numeric **Issuer ID**.
2. In Google Cloud, create a **service account** with the *Wallet Object Issuer*
   role, generate a JSON key, and authorise that service account in the Wallet
   Console.
3. Create a **GenericClass** with id `<issuerId>.business_card` (or any suffix
   you set via `GOOGLE_WALLET_CLASS_SUFFIX`). The simplest way is a one-off
   POST to `https://walletobjects.googleapis.com/walletobjects/v1/genericClass`
   with the minimal class body — see Google's quickstart.

Then add these runtime secrets:

| Key | Value |
| --- | --- |
| `GOOGLE_WALLET_ISSUER_ID` | numeric issuer ID from the console |
| `GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL` | `xxx@yyy.iam.gserviceaccount.com` |
| `GOOGLE_WALLET_SERVICE_ACCOUNT_PRIVATE_KEY` | the `private_key` field from the JSON key (newlines OK as `\n`) |
| `GOOGLE_WALLET_CLASS_SUFFIX` | *optional*, defaults to `business_card` |

The card page calls `/api/public/wallet-status` on mount to decide which
buttons to render. If Apple is unset, `/api/public/wallet/<slug>` returns
`503`; same for Google at `/api/public/google-wallet/<slug>`. When both are
unset, the card shows a single "Wallet passes not configured yet" notice.

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
