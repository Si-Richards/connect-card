
-- Roles
create type public.app_role as enum ('admin', 'user');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
alter table public.user_roles enable row level security;

-- Profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

-- Employees (digital business cards)
create table public.employees (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  full_name text not null,
  job_title text,
  company text,
  email text,
  office_phone text,
  mobile text,
  website text,
  linkedin text,
  notes text,
  photo_url text,
  disabled boolean not null default false,
  view_count integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.employees enable row level security;
create index employees_slug_idx on public.employees(slug);

-- Company settings (single row)
create table public.company_settings (
  id boolean primary key default true check (id),
  company_name text default 'Your Company',
  logo_url text,
  brand_color text default '#0f172a',
  updated_at timestamptz not null default now()
);
alter table public.company_settings enable row level security;
insert into public.company_settings (id) values (true);

-- has_role function
create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

-- updated_at trigger
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create trigger employees_updated_at before update on public.employees
  for each row execute function public.set_updated_at();
create trigger company_settings_updated_at before update on public.company_settings
  for each row execute function public.set_updated_at();

-- Auto-create profile and seed first user as admin
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare admin_count int;
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', new.email));

  select count(*) into admin_count from public.user_roles where role = 'admin';
  if admin_count = 0 then
    insert into public.user_roles (user_id, role) values (new.id, 'admin');
  else
    insert into public.user_roles (user_id, role) values (new.id, 'user');
  end if;
  return new;
end; $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- RLS Policies

-- user_roles: users see own, admins see all
create policy "users view own roles" on public.user_roles for select using (auth.uid() = user_id);
create policy "admins view all roles" on public.user_roles for select using (public.has_role(auth.uid(), 'admin'));
create policy "admins manage roles" on public.user_roles for all using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

-- profiles: users view/update own; admins all
create policy "view own profile" on public.profiles for select using (auth.uid() = id);
create policy "update own profile" on public.profiles for update using (auth.uid() = id);
create policy "admins view all profiles" on public.profiles for select using (public.has_role(auth.uid(), 'admin'));

-- employees: public can read non-disabled rows; admins manage all
create policy "public read enabled employees" on public.employees for select using (disabled = false);
create policy "admins read all employees" on public.employees for select using (public.has_role(auth.uid(), 'admin'));
create policy "admins insert employees" on public.employees for insert with check (public.has_role(auth.uid(), 'admin'));
create policy "admins update employees" on public.employees for update using (public.has_role(auth.uid(), 'admin'));
create policy "admins delete employees" on public.employees for delete using (public.has_role(auth.uid(), 'admin'));

-- company_settings: public read, admin write
create policy "public read company settings" on public.company_settings for select using (true);
create policy "admins update company settings" on public.company_settings for update using (public.has_role(auth.uid(), 'admin'));

-- Storage buckets
insert into storage.buckets (id, name, public) values ('employee-photos', 'employee-photos', true);
insert into storage.buckets (id, name, public) values ('company-assets', 'company-assets', true);

create policy "public read employee photos" on storage.objects for select using (bucket_id = 'employee-photos');
create policy "admins upload employee photos" on storage.objects for insert with check (bucket_id = 'employee-photos' and public.has_role(auth.uid(), 'admin'));
create policy "admins update employee photos" on storage.objects for update using (bucket_id = 'employee-photos' and public.has_role(auth.uid(), 'admin'));
create policy "admins delete employee photos" on storage.objects for delete using (bucket_id = 'employee-photos' and public.has_role(auth.uid(), 'admin'));

create policy "public read company assets" on storage.objects for select using (bucket_id = 'company-assets');
create policy "admins write company assets" on storage.objects for all using (bucket_id = 'company-assets' and public.has_role(auth.uid(), 'admin')) with check (bucket_id = 'company-assets' and public.has_role(auth.uid(), 'admin'));

-- Increment view count helper
create or replace function public.increment_employee_views(_slug text)
returns void language sql security definer set search_path = public as $$
  update public.employees set view_count = view_count + 1 where slug = _slug and disabled = false;
$$;
