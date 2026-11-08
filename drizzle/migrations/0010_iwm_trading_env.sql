ALTER TABLE public.iwm_strategy_settings ADD COLUMN IF NOT EXISTS trading_env text NOT NULL DEFAULT 'paper';
ALTER TABLE public.iwm_strategy_settings ADD CONSTRAINT iwm_trading_env_check CHECK (trading_env IN ('paper','live'));

CREATE OR REPLACE FUNCTION public.guard_iwm_trading_env()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
  IF NEW.trading_env IS DISTINCT FROM OLD.trading_env THEN
    IF EXISTS (SELECT 1 FROM public.iwm_strategy_state s WHERE s.user_id = NEW.user_id AND (s.open_trade IS NOT NULL OR s.pending_order IS NOT NULL OR s.savings_intent IS NOT NULL)) THEN
      RAISE EXCEPTION 'Close the open IWM trade or order before switching between Paper and Live.' USING ERRCODE = '42501';
    END IF;
    IF auth.role() = 'authenticated' AND NEW.trading_env = 'live' AND NOT public.has_recent_password_auth() THEN
      RAISE EXCEPTION 'Confirm your password before changing risk limits, enabling LIVE or turning off the kill switch.' USING ERRCODE = '42501';
    END IF;
    -- Each account starts from its own bankroll; never carry the paper balance into real money.
    UPDATE public.iwm_strategy_state SET balance = NULL WHERE user_id = NEW.user_id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS guard_iwm_trading_env ON public.iwm_strategy_settings;
CREATE TRIGGER guard_iwm_trading_env BEFORE UPDATE ON public.iwm_strategy_settings
FOR EACH ROW EXECUTE FUNCTION public.guard_iwm_trading_env();