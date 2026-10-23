ALTER TABLE public.iwm_strategy_settings ADD COLUMN IF NOT EXISTS kill_switch boolean NOT NULL DEFAULT false, ADD COLUMN IF NOT EXISTS max_daily_loss numeric NOT NULL DEFAULT 100;
ALTER TABLE public.iwm_strategy_state ADD COLUMN IF NOT EXISTS needs_review text, ADD COLUMN IF NOT EXISTS last_success_at timestamptz, ADD COLUMN IF NOT EXISTS session_close timestamptz;

CREATE TABLE public.bot_runs (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, started_at timestamptz NOT NULL, finished_at timestamptz NOT NULL DEFAULT now(), ok boolean NOT NULL, error text, duration_ms integer NOT NULL);
GRANT SELECT ON public.bot_runs TO authenticated; GRANT ALL ON public.bot_runs TO service_role;
ALTER TABLE public.bot_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own bot runs" ON public.bot_runs FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE INDEX bot_runs_user_time ON public.bot_runs(user_id, started_at DESC);

CREATE TABLE public.bot_errors (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), "where" text NOT NULL, message text NOT NULL, payload jsonb);
GRANT SELECT ON public.bot_errors TO authenticated; GRANT ALL ON public.bot_errors TO service_role;
ALTER TABLE public.bot_errors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own bot errors" ON public.bot_errors FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE INDEX bot_errors_user_time ON public.bot_errors(user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.iwm_save_state(p_user_id uuid, p_token uuid, p_state jsonb, p_events jsonb DEFAULT '{}'::jsonb)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$ DECLARE s public.iwm_strategy_state; e jsonb; t public.iwm_trades; BEGIN
PERFORM 1 FROM public.iwm_strategy_state WHERE user_id=p_user_id AND lock_token=p_token AND lock_until>now() FOR UPDATE;
IF NOT FOUND THEN RAISE EXCEPTION 'IWM lease expired'; END IF;
s:=jsonb_populate_record(NULL::public.iwm_strategy_state,p_state);
UPDATE public.iwm_strategy_state SET balance=s.balance,banked_total=s.banked_total,cycles=s.cycles,trading_day=s.trading_day,last_bar_time=s.last_bar_time,alerted_keys=s.alerted_keys,open_trade=s.open_trade,pending_order=s.pending_order,trades_today=s.trades_today,pnl_today=s.pnl_today,wins_today=s.wins_today,losses_today=s.losses_today,banked_today=s.banked_today,reported_day=s.reported_day,last_error=s.last_error,last_run_at=s.last_run_at,needs_review=s.needs_review,last_success_at=s.last_success_at,session_close=s.session_close WHERE user_id=p_user_id;
FOR e IN SELECT value FROM jsonb_array_elements(COALESCE(p_events->'signals','[]'::jsonb)) LOOP
INSERT INTO public.iwm_signals SELECT(jsonb_populate_record(NULL::public.iwm_signals,e||jsonb_build_object('user_id',p_user_id))).* ON CONFLICT(user_id,bar_time,kind,side) DO NOTHING;
END LOOP;
FOR e IN SELECT value FROM jsonb_array_elements(COALESCE(p_events->'trades','[]'::jsonb)) LOOP
t:=jsonb_populate_record(NULL::public.iwm_trades,e||jsonb_build_object('user_id',p_user_id));
INSERT INTO public.iwm_trades SELECT t.* ON CONFLICT(id) DO UPDATE SET exit_time=EXCLUDED.exit_time,exit_premium=EXCLUDED.exit_premium,exit_underlying=EXCLUDED.exit_underlying,peak_premium=EXCLUDED.peak_premium,peak_gain_pct=EXCLUDED.peak_gain_pct,final_floor_pct=EXCLUDED.final_floor_pct,gain_pct=EXCLUDED.gain_pct,pnl=EXCLUDED.pnl,exit_reason=EXCLUDED.exit_reason,bankroll_after=EXCLUDED.bankroll_after,alpaca_exit_order_id=EXCLUDED.alpaca_exit_order_id,status=EXCLUDED.status WHERE iwm_trades.user_id=p_user_id;
END LOOP;
FOR e IN SELECT value FROM jsonb_array_elements(COALESCE(p_events->'protection','[]'::jsonb)) LOOP
INSERT INTO public.iwm_protection_events SELECT(jsonb_populate_record(NULL::public.iwm_protection_events,e||jsonb_build_object('user_id',p_user_id))).*;
END LOOP;
FOR e IN SELECT value FROM jsonb_array_elements(COALESCE(p_events->'banks','[]'::jsonb)) LOOP
INSERT INTO public.iwm_bank_events SELECT(jsonb_populate_record(NULL::public.iwm_bank_events,e||jsonb_build_object('user_id',p_user_id))).*;
END LOOP;
FOR e IN SELECT value FROM jsonb_array_elements(COALESCE(p_events->'reports','[]'::jsonb)) LOOP
INSERT INTO public.iwm_daily_reports SELECT(jsonb_populate_record(NULL::public.iwm_daily_reports,e||jsonb_build_object('user_id',p_user_id))).* ON CONFLICT(user_id,day) DO NOTHING;
END LOOP;
END; $function$;
REVOKE ALL ON FUNCTION public.iwm_save_state(uuid,uuid,jsonb,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.iwm_save_state(uuid,uuid,jsonb,jsonb) TO service_role;