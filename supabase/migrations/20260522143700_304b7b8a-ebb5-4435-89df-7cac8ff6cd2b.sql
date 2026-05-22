
-- Set search_path on set_updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end; $$;

-- Revoke execute on security-definer functions from public/anon/authenticated
revoke execute on function public.has_role(uuid, public.app_role) from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.increment_employee_views(text) from public, anon, authenticated;

-- Allow anon + authenticated to call view increment (it's safe; only updates view_count on enabled rows)
grant execute on function public.increment_employee_views(text) to anon, authenticated;
-- has_role used by RLS via server context, but policies invoke it; needs grant to authenticated for policy eval? RLS uses function with definer; policies run as caller. Grant execute:
grant execute on function public.has_role(uuid, public.app_role) to anon, authenticated;

-- Restrict storage public listing: replace broad SELECT policies (the "public read" on storage allows listing).
-- We keep public read but it's only an issue if listing is undesired; for our app the photo URLs are predictable per record so listing is acceptable.
-- To satisfy the linter, drop the broad policies and replace with policies that allow object access by name without listing all objects: SELECT only matters for downloading via signed/public URLs. Public buckets already allow direct URL access regardless of policies. So we can DROP the SELECT policies safely.
drop policy if exists "public read employee photos" on storage.objects;
drop policy if exists "public read company assets" on storage.objects;
