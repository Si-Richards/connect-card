
CREATE TABLE IF NOT EXISTS public.employee_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('view','scan')),
  source text,
  user_agent text,
  referrer text,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS employee_events_employee_time_idx
  ON public.employee_events (employee_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS employee_events_time_idx
  ON public.employee_events (occurred_at DESC);

ALTER TABLE public.employee_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins read employee events"
  ON public.employee_events FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));
