CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  stripe_subscription_id text NOT NULL UNIQUE,
  stripe_customer_id text NOT NULL,
  product_id text NOT NULL,
  price_id text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  environment text NOT NULL DEFAULT 'sandbox',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_subscriptions_user_id ON public.subscriptions(user_id);
GRANT SELECT ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own subscriptions" ON public.subscriptions FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Complimentary access (owner / existing accounts). Not user-editable.
CREATE TABLE public.plan_grants (
  user_id uuid PRIMARY KEY,
  tier text NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.plan_grants TO authenticated;
GRANT ALL ON public.plan_grants TO service_role;
ALTER TABLE public.plan_grants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own grant" ON public.plan_grants FOR SELECT TO authenticated USING (auth.uid() = user_id);

INSERT INTO public.plan_grants (user_id, tier, note)
SELECT id, 'bots', 'Existing account before paywall' FROM auth.users
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.plan_tier(_user_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM plan_grants g WHERE g.user_id=_user_id AND g.tier='bots') THEN 'bots'
    WHEN EXISTS (SELECT 1 FROM subscriptions s WHERE s.user_id=_user_id AND s.price_id LIKE 'bots_%'
      AND ((s.status IN ('active','trialing','past_due') AND (s.current_period_end IS NULL OR s.current_period_end > now()))
        OR (s.status='canceled' AND s.current_period_end > now()))) THEN 'bots'
    WHEN EXISTS (SELECT 1 FROM plan_grants g WHERE g.user_id=_user_id AND g.tier='alerts') THEN 'alerts'
    WHEN EXISTS (SELECT 1 FROM subscriptions s WHERE s.user_id=_user_id AND s.price_id LIKE 'alerts_%'
      AND ((s.status IN ('active','trialing','past_due') AND (s.current_period_end IS NULL OR s.current_period_end > now()))
        OR (s.status='canceled' AND s.current_period_end > now()))) THEN 'alerts'
    ELSE NULL END
$$;

CREATE OR REPLACE FUNCTION public.guard_bot_plan()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NEW.enabled = true
     AND (TG_OP = 'INSERT' OR OLD.enabled IS DISTINCT FROM true)
     AND public.plan_tier(NEW.user_id) IS DISTINCT FROM 'bots' THEN
    RAISE EXCEPTION 'The AI Bots plan is required to turn on automated bots.';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER guard_bot_plan_pulse BEFORE INSERT OR UPDATE ON public.pulse_bot_configs
FOR EACH ROW EXECUTE FUNCTION public.guard_bot_plan();
CREATE TRIGGER guard_bot_plan_iwm BEFORE INSERT OR UPDATE ON public.iwm_strategy_settings
FOR EACH ROW EXECUTE FUNCTION public.guard_bot_plan();