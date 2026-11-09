ALTER TABLE public.pulse_bot_configs DROP CONSTRAINT IF EXISTS pulse_bot_configs_config_check;
ALTER TABLE public.pulse_bot_configs ADD CONSTRAINT pulse_bot_configs_config_check CHECK (config->>'strategyId' IN ('orb','vwap_reclaim','ema_pullback','ttm_squeeze','rsi2','macd_cross','band_bounce','supertrend','donchian','scalpers'));
