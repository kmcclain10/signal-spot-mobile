CREATE TABLE public.strategy_alert_preferences (
 user_id uuid PRIMARY KEY,
 automatic_enabled boolean NOT NULL DEFAULT true,
 strategy_ids text[] NOT NULL DEFAULT ARRAY['iwm','orb','vwap_reclaim','ema_pullback','ttm_squeeze','rsi2','macd_cross','band_bounce','supertrend','donchian','scalpers'],
 custom_rules jsonb NOT NULL DEFAULT '[]'::jsonb,
 updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT alert_rules_array CHECK (jsonb_typeof(custom_rules) = 'array')
);
GRANT SELECT, INSERT, UPDATE ON public.strategy_alert_preferences TO authenticated;
GRANT ALL ON public.strategy_alert_preferences TO service_role;
ALTER TABLE public.strategy_alert_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners read alert preferences" ON public.strategy_alert_preferences FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Owners insert alert preferences" ON public.strategy_alert_preferences FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Owners update alert preferences" ON public.strategy_alert_preferences FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TABLE public.strategy_scan_universe (
 id text PRIMARY KEY CHECK (id = 'us_market_cap'),
 symbols text[] NOT NULL,
 companies jsonb NOT NULL,
 source_url text NOT NULL,
 refreshed_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.strategy_scan_universe TO authenticated;
GRANT ALL ON public.strategy_scan_universe TO service_role;
ALTER TABLE public.strategy_scan_universe ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in users read scan markets" ON public.strategy_scan_universe FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);