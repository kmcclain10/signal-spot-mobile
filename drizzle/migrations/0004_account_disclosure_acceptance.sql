CREATE TABLE public.account_disclosure_acceptance (user_id uuid PRIMARY KEY, version text NOT NULL DEFAULT '2026-10-24', accepted_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT, INSERT, UPDATE ON public.account_disclosure_acceptance TO authenticated;
GRANT ALL ON public.account_disclosure_acceptance TO service_role;
ALTER TABLE public.account_disclosure_acceptance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read own acceptance" ON public.account_disclosure_acceptance FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Accept own disclosures" ON public.account_disclosure_acceptance FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Renew own acceptance" ON public.account_disclosure_acceptance FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);