# CardKit — Digital Business Cards

Mobile-first digital business cards for your team. Each employee gets a shareable
URL and a QR code that opens a contact page, downloads a vCard, or adds the card
to Apple Wallet. Admins can manage employees and see view/scan analytics.

## Features

- Public card page at `/card/<slug>` with photo, contact details and brand colour
- QR code generator (`/api/public/qr/<slug>?format=png|svg`)
- vCard download (`/api/public/vcard/<slug>`)
- Apple Wallet pass (`/api/public/wallet/<slug>`) — optional, needs Apple certs
- Admin dashboard with employee CRUD and company branding
- **Analytics**: per-employee card views and QR scans, 30-day daily breakdown,
  recent event log (source, referrer, user-agent)
- Email/password auth with admin role gating
- Centralised SSR error reporting (`/api/public/errors`) with request IDs

## Tech stack

- TanStack Start v1 (React 19, Vite 7) on Cloudflare Workers
- Supabase (Postgres + Auth + Storage) — managed as **Lovable Cloud**
- Tailwind CSS v4
- `qrcode`, `@walletpass/pass-js`

## Project layout

```
src/
├── routes/
│   ├── index.tsx                 landing page
│   ├── login.tsx                 email/password sign in
│   ├── card.$slug.tsx            public card page (records view/scan)
│   ├── _authenticated/
│   │   ├── route.tsx             auth guard layout
│   │   ├── admin.index.tsx       employee list + 30d analytics
│   │   ├── admin.new.tsx         create employee form
│   │   └── admin.$id.tsx         edit form + analytics panel
│   └── api/public/
│       ├── qr.$slug.ts           QR code (PNG/SVG)
│       ├── vcard.$slug.ts        vCard download
│       ├── wallet.$slug.ts       Apple Wallet pass
│       ├── errors.ts             SSR error ingest
│       └── healthcheck.ts
├── lib/
│   ├── employees.functions.ts    admin CRUD server fns
│   ├── analytics.functions.ts    view/scan recording + reporting
│   ├── employees.schema.ts       Zod schemas
│   ├── vcard.ts                  vCard builder
│   └── error-capture.ts          SSR error reporter
└── integrations/supabase/        auto-generated clients & types
```

See [INSTALL.md](./INSTALL.md) for setup. The reference SQL schema is in
[schema.sql](./schema.sql).
