create table public.connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  provider text not null,
  label text not null,
  environment text not null default 'paper',
  config jsonb not null default '{}',
  secret_cipher text,
  secret_iv text,
  secret_hint text,
  status text not null default 'untested',
  status_detail text,
  last_tested_at timestamptz,
  is_default_data boolean not null default false,
  is_default_broker boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index one_default_data on public.connections(user_id) where is_default_data;
create unique index one_default_broker on public.connections(user_id) where is_default_broker;

create table public.settings (
  user_id uuid primary key,
  watchlist text[] not null default array['SPY','QQQ','IWM','AAPL','NVDA','TSLA','AMD','META','MSFT','AMZN'],
  lookback_days int not null default 120,
  min_trades int not null default 20,
  min_win_rate numeric not null default 0.60,
  min_profit_factor numeric not null default 2.0,
  risk_per_trade_usd numeric not null default 50,
  max_open_positions int not null default 3,
  max_daily_loss_usd numeric not null default 150,
  trading_mode text not null default 'paper' check (trading_mode in ('paper','live')),
  updated_at timestamptz not null default now()
);

create table public.strategies (
  id text primary key,
  family text not null,
  side text not null check (side in ('long','short')),
  params jsonb not null default '{}',
  stop_atr numeric not null,
  target_r numeric
);

create table public.engine_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  kind text not null check (kind in ('nightly','backtest')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running',
  rule jsonb, summary jsonb, by_year jsonb, equity jsonb, most_selected jsonb,
  error text
);

create table public.picks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  run_id uuid references public.engine_runs(id) on delete cascade,
  trade_date date not null,
  strategy_id text not null references public.strategies(id),
  bt_trades int, bt_win_rate numeric, bt_profit_factor numeric, bt_avg_r numeric,
  unique (user_id, trade_date, strategy_id)
);

create table public.signals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  trade_date date not null,
  symbol text not null,
  strategy_id text not null references public.strategies(id),
  side text not null check (side in ('long','short')),
  entry numeric not null,
  stop numeric not null,
  target numeric,
  signal_time timestamptz not null,
  status text not null default 'new',
  created_at timestamptz not null default now(),
  unique (user_id, trade_date, symbol, strategy_id)
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  signal_id uuid references public.signals(id) on delete set null,
  connection_id uuid references public.connections(id) on delete set null,
  environment text not null,
  broker_order_id text,
  symbol text not null,
  side text not null,
  qty numeric not null,
  entry numeric, stop numeric, target numeric,
  status text not null default 'submitted',
  raw jsonb,
  created_at timestamptz not null default now()
);

grant select (id, user_id, provider, label, environment, config, secret_hint, status, status_detail,
  last_tested_at, is_default_data, is_default_broker, created_at, updated_at) on public.connections to authenticated;
grant delete on public.connections to authenticated;
grant all on public.connections to service_role;
grant select, insert, update on public.settings to authenticated;
grant all on public.settings to service_role;
grant select on public.strategies to authenticated;
grant all on public.strategies to service_role;
grant select on public.engine_runs to authenticated;
grant all on public.engine_runs to service_role;
grant select on public.picks to authenticated;
grant all on public.picks to service_role;
grant select on public.signals to authenticated;
grant update (status) on public.signals to authenticated;
grant all on public.signals to service_role;
grant select on public.orders to authenticated;
grant all on public.orders to service_role;

alter table public.connections enable row level security;
alter table public.settings enable row level security;
alter table public.strategies enable row level security;
alter table public.engine_runs enable row level security;
alter table public.picks enable row level security;
alter table public.signals enable row level security;
alter table public.orders enable row level security;

create policy "own connections read" on public.connections for select to authenticated using (user_id = auth.uid());
create policy "own connections delete" on public.connections for delete to authenticated using (user_id = auth.uid());
create policy "own settings read" on public.settings for select to authenticated using (user_id = auth.uid());
create policy "own settings insert" on public.settings for insert to authenticated with check (user_id = auth.uid());
create policy "own settings update" on public.settings for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "strategies readable" on public.strategies for select to authenticated using (true);
create policy "own runs" on public.engine_runs for select to authenticated using (user_id = auth.uid());
create policy "own picks" on public.picks for select to authenticated using (user_id = auth.uid());
create policy "own signals read" on public.signals for select to authenticated using (user_id = auth.uid());
create policy "own signals update" on public.signals for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own orders" on public.orders for select to authenticated using (user_id = auth.uid());

create function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin insert into public.settings(user_id) values (new.id) on conflict do nothing; return new; end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

alter publication supabase_realtime add table public.signals, public.picks, public.engine_runs;

-- 864 strategies: 36 entry variants x 2 sides x 3 stops x 4 exits
insert into public.strategies(id, family, side, params, stop_atr, target_r)
select e.fam || '(' || e.p || ')/' || s.code || '/stop' || st.v || '/' || coalesce(t.v::text || 'R', 'close'),
       e.fam, s.side,
       jsonb_build_object('p', case when e.p = '' then '[]'::jsonb else ('[' || e.p || ']')::jsonb end),
       st.v::numeric, t.v
from (values
  ('orb','3'),('orb','6'),('orb','12'),
  ('gap_and_go','0.2'),('gap_and_go','0.4'),('gap_and_go','0.7'),
  ('gap_fade','0.2,1'),('gap_fade','0.2,3'),('gap_fade','0.2,6'),('gap_fade','0.4,1'),('gap_fade','0.4,3'),('gap_fade','0.4,6'),('gap_fade','0.7,1'),('gap_fade','0.7,3'),('gap_fade','0.7,6'),
  ('prior_day_break',''),
  ('vwap_reclaim','0.3'),('vwap_reclaim','0.6'),
  ('momentum_at','12,0.3'),('momentum_at','12,0.6'),('momentum_at','30,0.3'),('momentum_at','30,0.6'),('momentum_at','54,0.3'),('momentum_at','54,0.6'),
  ('reversion_at','12,0.3'),('reversion_at','12,0.6'),('reversion_at','30,0.3'),('reversion_at','30,0.6'),('reversion_at','54,0.3'),('reversion_at','54,0.6'),
  ('trend_pullback','0.3'),('trend_pullback','0.6'),
  ('narrow_range_orb','0.6'),('narrow_range_orb','0.8'),
  ('power_hour','0.3'),('power_hour','0.6')
) as e(fam, p)
cross join (values ('L','long'),('S','short')) as s(code, side)
cross join (values ('0.15'),('0.3'),('0.5')) as st(v)
cross join (values (1),(2),(3),(null::int)) as t(v)
on conflict (id) do nothing;