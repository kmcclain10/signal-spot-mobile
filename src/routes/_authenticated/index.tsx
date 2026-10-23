import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { X, CandlestickChart, Activity } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useBroker, useHasBroker, useLatestBacktest, useRealtimeInvalidate } from "@/hooks/use-app-data";
import { isBeforeSignals, nyDate } from "@/lib/market-hours";
import { num, pct, signed, usd } from "@/lib/format";
import { strategySetup, parseStrategyId } from "@/lib/strategy-names";
import { EmptyState, ErrorState, LoadingRows, Panel, SideBadge } from "@/components/common";
import { SignalRow, type Signal } from "@/components/SignalRow";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Home — Pulse Signals" },
      { name: "description", content: "Your connected trading account, strategy picks and live trade signals." },
      { property: "og:title", content: "Home — Pulse Signals" },
      { property: "og:description", content: "Your trading account overview, strategy picks and live signals." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Today,
});

function AccountStrip() {
  const { hasBroker, loading } = useHasBroker();
  const acct = useBroker<{ equity: number; dayPl: number; buyingPower: number }>("getAccount");
  if (loading) return null;
  if (!hasBroker)
    return (
      <Panel className="flex items-center justify-between p-4 text-sm">
        <span className="text-muted-foreground">Connect a broker to see your account here.</span>
        <Link to="/connections" className="text-primary">
          Add connection
        </Link>
      </Panel>
    );
  if (acct.error) return <ErrorState error={acct.error} onRetry={() => acct.refetch()} />;
  const a = acct.data;
  return (
    <Panel className="grid grid-cols-3 divide-x">
      {[
        ["Equity", usd(a?.equity)],
        ["Day P&L", a ? signed(a.dayPl) : "—"],
        ["Buying power", usd(a?.buyingPower)],
      ].map(([l, v], i) => (
        <div key={l} className="p-4">
          <div className="text-xs text-muted-foreground">{l}</div>
          <div
            className={cn(
              "num mt-1 text-lg font-semibold",
              i === 1 && a && (a.dayPl >= 0 ? "text-gain" : "text-loss"),
            )}
          >
            {acct.isLoading ? "…" : v}
          </div>
        </div>
      ))}
    </Panel>
  );
}

function HonestyBanner() {
  const run = useLatestBacktest();
  const [hidden, setHidden] = useState(true);
  const key = `honesty-dismissed-${nyDate()}`;
  useEffect(() => setHidden(localStorage.getItem(key) === "1"), [key]);
  const oos = (run.data?.summary as any)?.oos;
  if (hidden || !oos) return null;
  return (
    <div className="flex items-start justify-between gap-3 rounded-[10px] border border-warning/40 bg-warning/10 px-4 py-2.5 text-sm">
      <span>
        Last backtest out-of-sample: <span className="num">{pct(oos.win_rate)}</span> win rate · PF{" "}
        <span className="num">{num(oos.profit_factor)}</span> — paper trade first.
      </span>
      <button
        aria-label="Dismiss"
        onClick={() => {
          localStorage.setItem(key, "1");
          setHidden(true);
        }}
      >
        <X className="size-4 text-muted-foreground" />
      </button>
    </div>
  );
}

function Picks() {
  const today = nyDate();
  const q = useQuery({
    queryKey: ["picks", today],
    queryFn: async () => {
      const { data, error } = await supabase.from("picks").select("*").eq("trade_date", today).order("bt_win_rate", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold">Today's picks</h2>
      {q.isLoading ? (
        <LoadingRows n={1} />
      ) : q.error ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : !q.data?.length ? (
        <EmptyState title="No strategies passed tonight's filters — that's normal." body="No picks = no trades." />
      ) : (
        <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2">
          {q.data.map((p) => {
            const s = parseStrategyId(p.strategy_id);
            return (
              <Panel key={p.id} className="w-64 shrink-0 snap-start p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="text-sm font-medium leading-snug">{strategySetup(p.strategy_id)}</div>
                  {s && <SideBadge side={s.side} />}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  stop {s?.stop} ATR · {s?.target == null ? "exit at close" : `target ${s.target}R`}
                </div>
                <div className="num mt-3 grid grid-cols-3 text-xs">
                  <div>
                    <div className="text-muted-foreground">WR</div>
                    {pct(p.bt_win_rate)}
                  </div>
                  <div>
                    <div className="text-muted-foreground">PF</div>
                    {num(p.bt_profit_factor)}
                  </div>
                  <div>
                    <div className="text-muted-foreground">Trades</div>
                    {p.bt_trades ?? "—"}
                  </div>
                </div>
              </Panel>
            );
          })}
        </div>
      )}
    </section>
  );
}

function LiveSignals() {
  const today = nyDate();
  const q = useQuery({
    queryKey: ["signals", "today", today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("signals")
        .select("*")
        .eq("trade_date", today)
        .order("signal_time", { ascending: false });
      if (error) throw error;
      return data as unknown as Signal[];
    },
  });
  const [early, setEarly] = useState(false);
  useEffect(() => setEarly(isBeforeSignals()), []);
  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold">Live signals</h2>
      {q.isLoading ? (
        <LoadingRows />
      ) : q.error ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : !q.data?.length ? (
        <EmptyState
          title={early ? "Signals start after the open." : "No signals yet today."}
          body="The engine scans your watchlist every 5 minutes during market hours."
        />
      ) : (
        <Panel>
          {q.data.map((s) => (
            <SignalRow key={s.id} s={s} />
          ))}
        </Panel>
      )}
    </section>
  );
}

function Today() {
  useRealtimeInvalidate("signals", [["signals"]]);
  useRealtimeInvalidate("picks", [["picks"]]);
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-3xl font-semibold">Home</h1><div className="flex gap-2"><Button variant="outline" asChild><Link to="/iwm"><Activity />IWM bot</Link></Button><Button asChild><Link to="/trade"><CandlestickChart />Trade</Link></Button></div></header>
      <AccountStrip />
      <HonestyBanner />
      <Picks />
      <LiveSignals />
    </div>
  );
}
