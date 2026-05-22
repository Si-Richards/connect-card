-- =============================================================================
-- CardKit — full database schema (Postgres / Supabase)
-- Run end-to-end against a fresh database.
-- =============================================================================

-- Extensions ------------------------------------------------------------------
create extension if not exists "pgcrypto";

-- Roles -----------------------------------------------------------------------
do $$ begin
  create type public.app_role as enum ('admin', 'moderator', 'user');
exception when duplicate_object then null;
end $$;

-- Profiles --------------------------------------------------------------------
create table if not exists public.profiles (
  id           uuid primary key,
  display_name text,
  created_at   timestamptz not null default now()
);
alter table public.profiles enable row level security;

-- User roles ------------------------------------------------------------------
create table if not exists public.user_roles (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null,
  role       public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
alter table public.user_roles enable row level security;

-- has_role: avoids recursive RLS. SECURITY DEFINER, no SECURITY barrier needed.
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  );
$$;

-- Company branding ------------------------------------------------------------
create table if not exists public.company_settings (
  id           boolean primary key default true,
  company_name text default 'Your Company',
  brand_color  text default '#0f172a',
  logo_url     text,
  updated_at   timestamptz not null default now(),
  constraint company_settings_singleton check (id = true)
);
alter table public.company_settings enable row level security;
insert into public.company_settings (id) values (true) on conflict do nothing;

-- Employees -------------------------------------------------------------------
create table if not exists public.employees (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique,
  full_name    text not null,
  job_title    text,
  company      text,
  email        text,
  office_phone text,
  mobile       text,
  website      text,
  linkedin     text,
  notes        text,
  photo_url    text,
  disabled     boolean not null default false,
  view_count   integer not null default 0,
  created_by   uuid,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
alter table public.employees enable row level security;
create index if not exists employees_slug_idx on public.employees (slug);

-- Increment view counter (called by the public card page) ---------------------
create or replace function public.increment_employee_views(_slug text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.employees
     set view_count = view_count + 1
   where slug = _slug and disabled = false;
$$;

-- Analytics events ------------------------------------------------------------
create table if not exists public.employee_events (
  id          uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  event_type  text not null check (event_type in ('view','scan')),
  source      text,
  user_agent  text,
  referrer    text,
  occurred_at timestamptz not null default now()
);
alter table public.employee_events enable row level security;
create index if not exists employee_events_employee_time_idx
  on public.employee_events (employee_id, occurred_at desc);
create index if not exists employee_events_time_idx
  on public.employee_events (occurred_at desc);

-- =============================================================================
-- Row-Level Security policies
-- =============================================================================

-- Profiles: each user manages their own, admins see all
drop policy if exists "view own profile"        on public.profiles;
drop policy if exists "update own profile"      on public.profiles;
drop policy if exists "admins view all profiles" on public.profiles;
create policy "view own profile"
  on public.profiles for select using (auth.uid() = id);
create policy "update own profile"
  on public.profiles for update using (auth.uid() = id);
create policy "admins view all profiles"
  on public.profiles for select using (public.has_role(auth.uid(), 'admin'));

-- User roles: users see their own, admins manage all
drop policy if exists "users view own roles" on public.user_roles;
drop policy if exists "admins view all roles" on public.user_roles;
drop policy if exists "admins manage roles"  on public.user_roles;
create policy "users view own roles"
  on public.user_roles for select using (auth.uid() = user_id);
create policy "admins view all roles"
  on public.user_roles for select using (public.has_role(auth.uid(), 'admin'));
create policy "admins manage roles"
  on public.user_roles for all
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- Company settings: world-readable, admins update
drop policy if exists "public read company settings"   on public.company_settings;
drop policy if exists "admins update company settings" on public.company_settings;
create policy "public read company settings"
  on public.company_settings for select using (true);
create policy "admins update company settings"
  on public.company_settings for update using (public.has_role(auth.uid(), 'admin'));

-- Employees: public reads only enabled rows, admins do everything
drop policy if exists "public read enabled employees" on public.employees;
drop policy if exists "admins read all employees"     on public.employees;
drop policy if exists "admins insert employees"       on public.employees;
drop policy if exists "admins update employees"       on public.employees;
drop policy if exists "admins delete employees"       on public.employees;
create policy "public read enabled employees"
  on public.employees for select using (disabled = false);
create policy "admins read all employees"
  on public.employees for select using (public.has_role(auth.uid(), 'admin'));
create policy "admins insert employees"
  on public.employees for insert with check (public.has_role(auth.uid(), 'admin'));
create policy "admins update employees"
  on public.employees for update using (public.has_role(auth.uid(), 'admin'));
create policy "admins delete employees"
  on public.employees for delete using (public.has_role(auth.uid(), 'admin'));

-- Employee events: admins read; writes go through service-role key server-side
drop policy if exists "admins read employee events" on public.employee_events;
create policy "admins read employee events"
  on public.employee_events for select using (public.has_role(auth.uid(), 'admin'));

-- =============================================================================
-- One-time bootstrap: grant the admin role to your first user
-- =============================================================================
-- insert into public.user_roles (user_id, role)
-- values ((select id from auth.users where email = 'you@example.com'), 'admin');
