
-- 1. Restrict sensitive PII on employees from anon/authenticated public reads
REVOKE SELECT ON public.employees FROM anon, authenticated;
GRANT SELECT (id, slug, full_name, job_title, company, website, linkedin, photo_url, disabled, view_count, created_at, updated_at)
  ON public.employees TO anon, authenticated;
-- Admins keep full access via service_role and via authenticated admin policy; ensure admin SELECT still works on all columns
GRANT SELECT ON public.employees TO service_role;

-- Note: column-level GRANTs combined with RLS policies restrict anon to safe columns.
-- The "admins read all employees" policy applies to authenticated admins, but column grants would also limit them.
-- Grant full column SELECT back specifically for authenticated (RLS still enforces row scoping via policies).
GRANT SELECT ON public.employees TO authenticated;

-- Better approach: keep public policy column-scoped via a view
DROP POLICY IF EXISTS "public read enabled employees" ON public.employees;

CREATE OR REPLACE VIEW public.employees_public
WITH (security_invoker = true) AS
SELECT id, slug, full_name, job_title, company, website, linkedin, photo_url, view_count
FROM public.employees
WHERE disabled = false;

-- Recreate the public policy but restrict to no sensitive columns by limiting anon entirely on the base table
CREATE POLICY "anon no direct base table read"
  ON public.employees FOR SELECT TO anon
  USING (false);

CREATE POLICY "authenticated read enabled employees"
  ON public.employees FOR SELECT TO authenticated
  USING (disabled = false OR has_role(auth.uid(), 'admin'::app_role));

REVOKE ALL ON public.employees_public FROM PUBLIC;
GRANT SELECT ON public.employees_public TO anon, authenticated;

-- 2. employee_events INSERT policy — allow anon/authenticated to log events for enabled employees with whitelisted types
CREATE POLICY "public insert card events"
  ON public.employee_events FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    event_type IN ('view', 'qr_scan', 'vcard_download', 'wallet_download', 'booking_click')
    AND EXISTS (SELECT 1 FROM public.employees e WHERE e.id = employee_id AND e.disabled = false)
  );

GRANT INSERT ON public.employee_events TO anon, authenticated;

-- 3. Restrict EXECUTE on SECURITY DEFINER functions to only what's needed.
-- has_role is used inside RLS policies (runs regardless of EXECUTE grants), so revoke from public callers.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
