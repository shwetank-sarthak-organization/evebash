-- Fix: Add explicit SELECT policy for anon + authenticated roles on modal_cost_logs.
-- The original policy had no FOR clause (defaults to ALL) but was intended for service role writes.
-- The analytics dashboard uses the anon key and needs explicit SELECT permission.

CREATE POLICY "Allow anon and authenticated read" ON public.modal_cost_logs
    FOR SELECT
    TO anon, authenticated
    USING (true);
