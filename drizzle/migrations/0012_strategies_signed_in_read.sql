DROP POLICY IF EXISTS "strategies readable" ON public.strategies;
CREATE POLICY "strategies readable by signed-in users" ON public.strategies FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
REVOKE SELECT ON public.strategies FROM anon;