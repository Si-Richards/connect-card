
## Goal

Move this app off Lovable Cloud (Supabase Postgres + Supabase Auth + Supabase Storage) and run it on your own infrastructure with **MySQL** as the database.

## Heads-up before we start

This is a sizeable rewrite, not a config change. The current app leans heavily on Supabase-specific features:

- **Auth** — `supabase.auth` (sessions, JWT, Google OAuth, RLS-aware bearer tokens)
- **Database** — Postgres-only features: `gen_random_uuid()`, `uuid` columns, `app_role` enum, RLS policies, `has_role()` SECURITY DEFINER function, `auth.uid()` everywhere
- **Storage** — employee photo uploads
- **Generated client** — `src/integrations/supabase/client.ts` + `types.ts` (auto-generated, used across the app)
- **Server middleware** — `requireSupabaseAuth`, `attachSupabaseAuth`, `supabaseAdmin`

MySQL has no equivalent of RLS or `auth.uid()`. **All access control has to move into application code** (server functions). That's the biggest conceptual shift.

## Target architecture

```text
Browser  ──►  TanStack Start (Node server, self-hosted)
                 │
                 ├── Auth: Lucia / Auth.js / custom JWT  ──►  MySQL (users, sessions)
                 ├── Server functions  ──►  MySQL via Drizzle ORM (mysql2 driver)
                 └── File storage  ──►  local disk OR S3-compatible bucket
```

### Stack choices I'd recommend (open for discussion)

| Concern | Recommendation | Why |
|---|---|---|
| MySQL driver | `mysql2` | De-facto standard, prepared statements, pooling |
| ORM | **Drizzle ORM** (mysql-core) | Type-safe, lightweight, generates migrations, replaces `types.ts` |
| Auth | **Lucia v3** (or Auth.js) + Google OAuth provider | Session cookies in MySQL, drop-in Google login |
| Migrations | `drizzle-kit` | Schema-first, version-controlled SQL |
| File storage | Local disk (simple) or S3/MinIO (scalable) | You pick based on deploy target |
| Runtime | Node 20+ (not Cloudflare Workers) | `mysql2` needs Node sockets; current Worker runtime won't work |
| Deploy target | Docker (app + MySQL + reverse proxy) | Portable self-host |

## Work breakdown

### 1. Database schema (MySQL via Drizzle)
Recreate the 4 tables in MySQL syntax:
- `users` (replaces `auth.users` — id, email, password_hash or oauth_id, email_verified_at)
- `sessions` (Lucia/Auth.js session store)
- `profiles` (id FK→users, display_name)
- `user_roles` (id, user_id, role ENUM('admin','moderator','user'))
- `employees` (UUID via app-generated `crypto.randomUUID()`, all current columns)
- `company_settings` (singleton row)

UUIDs stored as `CHAR(36)` or `BINARY(16)`. No RLS — enforce via server-function middleware.

### 2. Replace Supabase auth
- Delete `src/integrations/supabase/*`
- New `src/lib/auth.ts` with Lucia + Google OAuth
- New `requireAuth` / `requireAdmin` server middleware
- Rewrite `/login` and `_authenticated` route guard

### 3. Replace Supabase client calls
Every `supabase.from(...)` / `supabaseAdmin.from(...)` call gets rewritten to Drizzle queries inside server functions. Affected files (rough list):
- `src/lib/employees.functions.ts`
- `src/routes/api/public/{wallet,qr,vcard,healthcheck}.$slug.ts`
- `src/routes/card.$slug.tsx`
- `src/routes/_authenticated/admin.*.tsx`
- `src/routes/login.tsx`

### 4. Replace Supabase Storage
Add an upload endpoint (`/api/upload`) that writes to local disk under `/data/uploads` (or pushes to S3). Update admin forms to POST files there instead of `supabase.storage.from(...)`.

### 5. Runtime + deploy
- Change `vite.config.ts` / `wrangler.jsonc` target from Cloudflare Workers to Node
- Add `Dockerfile` + `docker-compose.yml` (app + MySQL 8 + optional Caddy/nginx)
- Env file template: `DATABASE_URL`, `SESSION_SECRET`, `GOOGLE_CLIENT_ID/SECRET`, Apple Wallet vars, `APP_ORIGIN`

### 6. Data migration (if you have prod data)
One-off script: dump current Postgres tables → transform UUIDs/enums → load into MySQL. Optional, depending on whether you want to preserve existing employees.

## What I need from you before building

1. **Auth library**: Lucia v3 (lean, modern) or Auth.js/NextAuth-style (more batteries)?
2. **ORM**: Drizzle (recommended) or raw `mysql2` with hand-written SQL?
3. **File storage**: local disk on the server, or S3-compatible bucket (which one)?
4. **Existing data**: do you need the current employees/settings migrated, or starting fresh?
5. **Deploy target**: Docker Compose on a VPS? Bare Node + systemd? Something else?
6. **Google OAuth**: keep it, or password-only?

Once you confirm those six, I'll switch to build mode and execute. Expect this to touch ~25 files and take multiple iterations to fully verify.
