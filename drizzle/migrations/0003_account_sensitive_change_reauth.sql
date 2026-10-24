CREATE OR REPLACE FUNCTION public.has_recent_password_auth() RETURNS boolean LANGUAGE sql STABLE SET search_path = '' AS $$
 SELECT EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(auth.jwt()->'amr','[]'::jsonb)) AS a WHERE a->>'method' = 'password' AND (a->>'timestamp')::numeric >= extract(epoch from now()) - 300 AND (a->>'timestamp')::numeric <= extract(epoch from now()) + 30);
$$;
REVOKE ALL ON FUNCTION public.has_recent_password_auth() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_recent_password_auth() TO authenticated, service_role;
CREATE OR REPLACE FUNCTION public.guard_sensitive_account_change() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE sensitive boolean := false;
BEGIN
 IF auth.role() IS DISTINCT FROM 'authenticated' THEN RETURN NEW; END IF;
 IF TG_TABLE_NAME = 'settings' THEN
 sensitive := (NEW.trading_mode = 'live' AND NEW.trading_mode IS DISTINCT FROM OLD.trading_mode) OR NEW.risk_per_trade_usd IS DISTINCT FROM OLD.risk_per_trade_usd OR NEW.max_open_positions IS DISTINCT FROM OLD.max_open_positions OR NEW.max_daily_loss_usd IS DISTINCT FROM OLD.max_daily_loss_usd;
 ELSE
 sensitive := (OLD.kill_switch AND (NOT NEW.kill_switch OR NEW.enabled)) OR NEW.max_daily_loss IS DISTINCT FROM OLD.max_daily_loss OR NEW.stop_loss_pct IS DISTINCT FROM OLD.stop_loss_pct OR NEW.max_trades_per_day IS DISTINCT FROM OLD.max_trades_per_day OR NEW.force_exit_time IS DISTINCT FROM OLD.force_exit_time;
 END IF;
 IF sensitive AND NOT public.has_recent_password_auth() THEN RAISE EXCEPTION 'Confirm your password before changing risk limits, enabling LIVE or turning off the kill switch.' USING ERRCODE = '42501'; END IF;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_sensitive_account_change() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guard_sensitive_account_change() TO service_role;
CREATE TRIGGER guard_sensitive_settings BEFORE UPDATE ON public.settings FOR EACH ROW EXECUTE FUNCTION public.guard_sensitive_account_change();
CREATE TRIGGER guard_sensitive_iwm_settings BEFORE UPDATE ON public.iwm_strategy_settings FOR EACH ROW EXECUTE FUNCTION public.guard_sensitive_account_change();