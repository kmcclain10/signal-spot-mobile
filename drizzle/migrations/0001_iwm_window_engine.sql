CREATE TABLE public.iwm_strategy_settings (user_id uuid PRIMARY KEY, enabled boolean NOT NULL DEFAULT false, timeframe_min integer NOT NULL DEFAULT 2 CHECK(timeframe_min IN(1,2,4,5,10)), starting_bankroll numeric NOT NULL DEFAULT 200 CHECK(starting_bankroll>0), bank_trigger numeric NOT NULL DEFAULT 25200 CHECK(bank_trigger>starting_bankroll), stop_loss_pct numeric NOT NULL DEFAULT 30 CHECK(stop_loss_pct>0 AND stop_loss_pct<=100), max_trades_per_day integer NOT NULL DEFAULT 15 CHECK(max_trades_per_day BETWEEN 1 AND 100), force_exit_time text NOT NULL DEFAULT '15:50' CHECK(force_exit_time ~ '^1[0-5]:[0-5][0-9]$' AND force_exit_time<='15:50'), discord_enabled boolean NOT NULL DEFAULT true, data_feed text NOT NULL DEFAULT 'iex' CHECK(data_feed IN('iex','sip')), options_feed text NOT NULL DEFAULT 'indicative' CHECK(options_feed IN('indicative','opra')));
GRANT SELECT,INSERT,UPDATE ON public.iwm_strategy_settings TO authenticated;
GRANT ALL ON public.iwm_strategy_settings TO service_role;
ALTER TABLE public.iwm_strategy_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own iwm settings read" ON public.iwm_strategy_settings FOR SELECT TO authenticated USING(user_id=auth.uid());
CREATE POLICY "own iwm settings insert" ON public.iwm_strategy_settings FOR INSERT TO authenticated WITH CHECK(user_id=auth.uid());
CREATE POLICY "own iwm settings update" ON public.iwm_strategy_settings FOR UPDATE TO authenticated USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid());
CREATE TABLE public.iwm_strategy_state (user_id uuid PRIMARY KEY, balance numeric, banked_total numeric NOT NULL DEFAULT 0, cycles integer NOT NULL DEFAULT 1, trading_day date, last_bar_time timestamptz, alerted_keys jsonb NOT NULL DEFAULT '[]', open_trade jsonb, pending_order jsonb, trades_today integer NOT NULL DEFAULT 0, pnl_today numeric NOT NULL DEFAULT 0, wins_today integer NOT NULL DEFAULT 0, losses_today integer NOT NULL DEFAULT 0, banked_today numeric NOT NULL DEFAULT 0, reported_day date, lock_until timestamptz, lock_token uuid, last_error text, last_run_at timestamptz);
GRANT SELECT ON public.iwm_strategy_state TO authenticated;
GRANT ALL ON public.iwm_strategy_state TO service_role;
ALTER TABLE public.iwm_strategy_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own iwm state read" ON public.iwm_strategy_state FOR SELECT TO authenticated USING(user_id=auth.uid());
CREATE TABLE public.iwm_signals (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), bar_time timestamptz NOT NULL, "window" integer NOT NULL CHECK("window" BETWEEN 1 AND 15), kind text NOT NULL CHECK(kind IN('potential','entry')), side text NOT NULL CHECK(side IN('CALL','PUT')), price numeric NOT NULL, ema8 numeric, ema20 numeric, osc numeric, detail text, action text, UNIQUE(user_id,bar_time,kind,side));
GRANT SELECT ON public.iwm_signals TO authenticated;
GRANT ALL ON public.iwm_signals TO service_role;
ALTER TABLE public.iwm_signals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own iwm signals read" ON public.iwm_signals FOR SELECT TO authenticated USING(user_id=auth.uid());
CREATE TABLE public.iwm_trades (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, side text NOT NULL CHECK(side IN('CALL','PUT')), option_symbol text NOT NULL, strike numeric NOT NULL, expiry date NOT NULL, "window" integer NOT NULL, contracts integer NOT NULL CHECK(contracts>0), entry_time timestamptz NOT NULL, entry_premium numeric NOT NULL, entry_underlying numeric, exit_time timestamptz, exit_premium numeric, exit_underlying numeric, peak_premium numeric, peak_gain_pct numeric, final_floor_pct numeric, gain_pct numeric, pnl numeric, exit_reason text, bankroll_after numeric, cycle integer, alpaca_entry_order_id text UNIQUE, alpaca_exit_order_id text, status text NOT NULL DEFAULT 'open' CHECK(status IN('open','closed')));
GRANT SELECT ON public.iwm_trades TO authenticated;
GRANT ALL ON public.iwm_trades TO service_role;
ALTER TABLE public.iwm_trades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own iwm trades read" ON public.iwm_trades FOR SELECT TO authenticated USING(user_id=auth.uid());
CREATE TABLE public.iwm_protection_events (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, trade_id uuid NOT NULL REFERENCES public.iwm_trades(id), created_at timestamptz NOT NULL DEFAULT now(), premium numeric NOT NULL, peak_gain_pct numeric NOT NULL, floor_locked_pct numeric NOT NULL);
GRANT SELECT ON public.iwm_protection_events TO authenticated;
GRANT ALL ON public.iwm_protection_events TO service_role;
ALTER TABLE public.iwm_protection_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own iwm protection read" ON public.iwm_protection_events FOR SELECT TO authenticated USING(user_id=auth.uid());
CREATE TABLE public.iwm_bank_events (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), amount_banked numeric NOT NULL, banked_total numeric NOT NULL, restart_balance numeric NOT NULL, new_cycle integer NOT NULL);
GRANT SELECT ON public.iwm_bank_events TO authenticated;
GRANT ALL ON public.iwm_bank_events TO service_role;
ALTER TABLE public.iwm_bank_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own iwm bank events read" ON public.iwm_bank_events FOR SELECT TO authenticated USING(user_id=auth.uid());
CREATE TABLE public.iwm_daily_reports (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, day date NOT NULL, trades integer NOT NULL, wins integer NOT NULL, losses integer NOT NULL, win_rate numeric NOT NULL, pnl numeric NOT NULL, banked_today numeric NOT NULL, banked_total numeric NOT NULL, ending_bankroll numeric NOT NULL, UNIQUE(user_id,day));
GRANT SELECT ON public.iwm_daily_reports TO authenticated;
GRANT ALL ON public.iwm_daily_reports TO service_role;
ALTER TABLE public.iwm_daily_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own iwm reports read" ON public.iwm_daily_reports FOR SELECT TO authenticated USING(user_id=auth.uid());
CREATE INDEX ON public.iwm_signals(user_id,created_at DESC);
CREATE INDEX ON public.iwm_trades(user_id,entry_time DESC);
CREATE INDEX ON public.iwm_protection_events(user_id,trade_id);
ALTER PUBLICATION supabase_realtime ADD TABLE public.iwm_signals,public.iwm_trades,public.iwm_strategy_state;
CREATE FUNCTION public.iwm_acquire_lock(p_user_id uuid,p_token uuid) RETURNS SETOF public.iwm_strategy_state LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
INSERT INTO public.iwm_strategy_state(user_id) VALUES(p_user_id) ON CONFLICT DO NOTHING;
RETURN QUERY UPDATE public.iwm_strategy_state SET lock_until=now()+interval '50 seconds',lock_token=p_token WHERE user_id=p_user_id AND(lock_until IS NULL OR lock_until<=now()) RETURNING *;
END; $$;
REVOKE ALL ON FUNCTION public.iwm_acquire_lock(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.iwm_acquire_lock(uuid,uuid) TO service_role;
CREATE FUNCTION public.iwm_save_state(p_user_id uuid,p_token uuid,p_state jsonb,p_events jsonb DEFAULT '{}'::jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE s public.iwm_strategy_state; e jsonb; t public.iwm_trades; BEGIN
PERFORM 1 FROM public.iwm_strategy_state WHERE user_id=p_user_id AND lock_token=p_token AND lock_until>now() FOR UPDATE;
IF NOT FOUND THEN RAISE EXCEPTION 'IWM lease expired'; END IF;
s:=jsonb_populate_record(NULL::public.iwm_strategy_state,p_state);
UPDATE public.iwm_strategy_state SET balance=s.balance,banked_total=s.banked_total,cycles=s.cycles,trading_day=s.trading_day,last_bar_time=s.last_bar_time,alerted_keys=s.alerted_keys,open_trade=s.open_trade,pending_order=s.pending_order,trades_today=s.trades_today,pnl_today=s.pnl_today,wins_today=s.wins_today,losses_today=s.losses_today,banked_today=s.banked_today,reported_day=s.reported_day,last_error=s.last_error,last_run_at=s.last_run_at WHERE user_id=p_user_id;
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
END; $$;
REVOKE ALL ON FUNCTION public.iwm_save_state(uuid,uuid,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.iwm_save_state(uuid,uuid,jsonb,jsonb) TO service_role;