CREATE TABLE public.strategy_alerts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL,
 strategy_id text NOT NULL,
 symbol text NOT NULL,
 side text NOT NULL CHECK (side IN ('long','short')),
 bar_time timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 price numeric NOT NULL,
 reason text NOT NULL,
 timeframe_min integer NOT NULL,
 data_feed text NOT NULL,
 environment text NOT NULL CHECK (environment IN ('paper','live')),
 UNIQUE(user_id,strategy_id,symbol,bar_time,side)
);
GRANT SELECT ON public.strategy_alerts TO authenticated;
GRANT ALL ON public.strategy_alerts TO service_role;
ALTER TABLE public.strategy_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY strategy_alerts_owner_read ON public.strategy_alerts FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE INDEX strategy_alerts_owner_time ON public.strategy_alerts(user_id,created_at DESC);
COMMENT ON TABLE public.strategies IS 'DEPRECATED: legacy permutation catalog; customer playbook uses executable strategy definitions.';
COMMENT ON TABLE public.picks IS 'DEPRECATED: bundled-backtest picks; replaced by real strategy triggers.';
COMMENT ON TABLE public.signals IS 'DEPRECATED: legacy scanner signals; replaced by strategy_alerts, iwm_signals and pulse_bot_events.';