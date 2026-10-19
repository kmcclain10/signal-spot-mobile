import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { FAMILY_DESCRIPTION, FAMILY_LABEL, setupName, strategyName } from "@/lib/strategy-names";
import { nyDate } from "@/lib/market-hours";
import { num, pct } from "@/lib/format";
import { EmptyState, ErrorState, LoadingRows, PageHeader, Panel, SideBadge } from "@/components/common";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/strategies")({
  head: () => ({
    meta: [
      { title: "Strategy Library — Pulse Signals" },
      { name: "description", content: "Browse all 864 intraday strategies the engine tests every night." },
      { property: "og:title", content: "Strategy Library — Pulse Signals" },
      { property: "og:description", content: "Browse all 864 intraday strategies the engine tests every night." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: StrategiesPage,
});

type Strat = { id: string; family: string; side: string; params: any; stop_atr: number; target_r: number | null };

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-xs transition-colors",
        on ? "border-primary bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function StrategiesPage() {
  const mobile = useIsMobile();
  const [search, setSearch] = useState("");
  const [family, setFamily] = useState<string | null>(null);
  const [side, setSide] = useState<string | null>(null);
  const [stop, setStop] = useState<number | null>(null);
  const [target, setTarget] = useState<string | null>(null);
  const [pickedOnly, setPickedOnly] = useState(false);
  const [open, setOpen] = useState<Strat | null>(null);

  const strats = useQuery({
    queryKey: ["strategies"],
    queryFn: async () => {
      const { data, error } = await supabase.from("strategies").select("*").order("id").limit(2000);
      if (error) throw error;
      return data as unknown as Strat[];
    },
  });
  const picks = useQuery({
    queryKey: ["picks", "all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("picks").select("*").order("trade_date", { ascending: false }).limit(5000);
      if (error) throw error;
      return data;
    },
  });
  const runs = useQuery({
    queryKey: ["runs", "most-selected"],
    queryFn: async () => {
      const { data } = await supabase
        .from("engine_runs")
        .select("most_selected")
        .eq("kind", "backtest")
        .order("finished_at", { ascending: false })
        .limit(1);
      return ((data?.[0]?.most_selected as any[]) ?? []) as any[];
    },
  });

  const today = nyDate();
  const pickStats = useMemo(() => {
    const m = new Map<string, { days: number; last: any; today: boolean }>();
    for (const p of picks.data ?? []) {
      const e = m.get(p.strategy_id) ?? { days: 0, last: p, today: false };
      e.days++;
      if (p.trade_date === today) e.today = true;
      m.set(p.strategy_id, e);
    }
    return m;
  }, [picks.data, today]);
  const oosById = useMemo(() => new Map((runs.data ?? []).map((r) => [r.strategy, r])), [runs.data]);

  const rows = useMemo(() => {
    const s = search.toLowerCase();
    return (strats.data ?? []).filter(
      (x) =>
        (!s || x.id.toLowerCase().includes(s) || strategyName(x.id).toLowerCase().includes(s)) &&
        (!family || x.family === family) &&
        (!side || x.side === side) &&
        (stop == null || Number(x.stop_atr) === stop) &&
        (!target || (target === "close" ? x.target_r == null : String(x.target_r) === target)) &&
        (!pickedOnly || pickStats.get(x.id)?.today),
    );
  }, [strats.data, search, family, side, stop, target, pickedOnly, pickStats]);

  const params = (x: Strat): number[] => (Array.isArray(x.params?.p) ? x.params.p : []);
  const sel = open;
  const selPick = sel ? pickStats.get(sel.id) : undefined;
  const selOos = sel ? oosById.get(sel.id) : undefined;

  return (
    <div>
      <PageHeader title="Strategy Library" sub={`${strats.data?.length ?? 864} setups tested nightly.`} />
      <Button asChild variant="outline" className="mb-5 h-auto w-full justify-between whitespace-normal py-4"><Link to="/iwm"><span className="text-left">IWM 20-Min Window<span className="mt-1 block text-xs text-muted-foreground">Paper automation • Options</span></span><span className="text-gain">Open →</span></Link></Button>
      <div className="mb-3 flex flex-col gap-3">
        <Input placeholder="Search strategies…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <div className="flex flex-wrap gap-2">
          {Object.entries(FAMILY_LABEL).map(([k, v]) => (
            <Chip key={k} on={family === k} onClick={() => setFamily(family === k ? null : k)}>{v}</Chip>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {["long", "short"].map((k) => (
            <Chip key={k} on={side === k} onClick={() => setSide(side === k ? null : k)}>{k === "long" ? "Long" : "Short"}</Chip>
          ))}
          <span className="mx-1 h-4 w-px bg-border" />
          {[0.15, 0.3, 0.5].map((k) => (
            <Chip key={k} on={stop === k} onClick={() => setStop(stop === k ? null : k)}>stop {k}</Chip>
          ))}
          <span className="mx-1 h-4 w-px bg-border" />
          {["1", "2", "3", "close"].map((k) => (
            <Chip key={k} on={target === k} onClick={() => setTarget(target === k ? null : k)}>{k === "close" ? "close" : `${k}R`}</Chip>
          ))}
          <div className="ml-auto flex items-center gap-2">
            <Switch id="picked" checked={pickedOnly} onCheckedChange={setPickedOnly} />
            <Label htmlFor="picked" className="text-xs">Picked today</Label>
          </div>
        </div>
      </div>

      {strats.isLoading ? (
        <LoadingRows n={8} />
      ) : strats.error ? (
        <ErrorState error={strats.error} onRetry={() => strats.refetch()} />
      ) : !rows.length ? (
        <EmptyState title="No strategies match these filters." />
      ) : (
        <Panel className="overflow-hidden">
          <div className="hidden grid-cols-[1fr_140px_70px_70px_70px_60px] gap-3 border-b px-4 py-2 text-xs text-muted-foreground md:grid">
            <span>Setup</span><span>Family</span><span>Side</span><span className="text-right">Stop</span>
            <span className="text-right">Target</span><span className="text-right">Days</span>
          </div>
          <div className="max-h-[70vh] overflow-y-auto">
            {rows.slice(0, 300).map((x) => (
              <button
                key={x.id}
                onClick={() => setOpen(x)}
                className="grid w-full grid-cols-[1fr_auto] gap-x-3 gap-y-1 border-b px-4 py-2.5 text-left text-sm last:border-0 hover:bg-accent md:grid-cols-[1fr_140px_70px_70px_70px_60px] md:items-center"
              >
                <span className="truncate">{setupName(x.family, params(x))}</span>
                <span className="hidden truncate text-xs text-muted-foreground md:block">{FAMILY_LABEL[x.family]}</span>
                <span><SideBadge side={x.side} /></span>
                <span className="num text-xs text-muted-foreground md:text-right md:text-foreground">{x.stop_atr}×ATR</span>
                <span className="num text-right text-xs">{x.target_r == null ? "close" : `${x.target_r}R`}</span>
                <span className="num hidden text-right text-xs md:block">{pickStats.get(x.id)?.days ?? 0}</span>
              </button>
            ))}
          </div>
          {rows.length > 300 && (
            <div className="border-t px-4 py-2 text-xs text-muted-foreground">Showing 300 of {rows.length} — refine your search.</div>
          )}
        </Panel>
      )}

      <Sheet open={!!sel} onOpenChange={(o) => !o && setOpen(null)}>
        <SheetContent side={mobile ? "bottom" : "right"} className="overflow-y-auto sm:max-w-md">
          {sel && (
            <>
              <SheetHeader>
                <SheetTitle>{setupName(sel.family, params(sel))}</SheetTitle>
                <SheetDescription>{strategyName(sel.id)}</SheetDescription>
              </SheetHeader>
              <div className="space-y-5 p-4 text-sm">
                <p className="text-muted-foreground">{FAMILY_DESCRIPTION[sel.family]}</p>
                <dl className="num grid grid-cols-2 gap-y-1.5 text-xs">
                  <dt className="text-muted-foreground">Engine id</dt><dd className="text-right">{sel.id}</dd>
                  <dt className="text-muted-foreground">Params</dt><dd className="text-right">{params(sel).join(", ") || "—"}</dd>
                  <dt className="text-muted-foreground">Stop</dt><dd className="text-right">{sel.stop_atr} × daily ATR</dd>
                  <dt className="text-muted-foreground">Exit</dt><dd className="text-right">{sel.target_r == null ? "Hold to close" : `${sel.target_r}R target`}</dd>
                  <dt className="text-muted-foreground">Days selected</dt><dd className="text-right">{selPick?.days ?? 0}</dd>
                </dl>
                <div>
                  <div className="mb-2 text-xs font-semibold">Last pick (backtest window — in-sample)</div>
                  {selPick ? (
                    <dl className="num grid grid-cols-2 gap-y-1 text-xs">
                      <dt className="text-muted-foreground">Date</dt><dd className="text-right">{selPick.last.trade_date}</dd>
                      <dt className="text-muted-foreground">Win rate</dt><dd className="text-right">{pct(selPick.last.bt_win_rate)}</dd>
                      <dt className="text-muted-foreground">Profit factor</dt><dd className="text-right">{num(selPick.last.bt_profit_factor)}</dd>
                      <dt className="text-muted-foreground">Trades</dt><dd className="text-right">{selPick.last.bt_trades}</dd>
                    </dl>
                  ) : (
                    <p className="text-xs text-muted-foreground">Never picked yet.</p>
                  )}
                </div>
                <div>
                  <div className="mb-2 text-xs font-semibold">Out-of-sample (traded next day)</div>
                  {selOos ? (
                    <dl className="num grid grid-cols-2 gap-y-1 text-xs">
                      <dt className="text-muted-foreground">Days selected</dt><dd className="text-right">{selOos.days_selected}</dd>
                      <dt className="text-muted-foreground">Trades</dt><dd className="text-right">{selOos.trades}</dd>
                      <dt className="text-muted-foreground">Win rate</dt><dd className={cn("text-right", selOos.win_rate >= 0.6 ? "text-gain" : "text-loss")}>{pct(selOos.win_rate)}</dd>
                      <dt className="text-muted-foreground">Profit factor</dt><dd className={cn("text-right", selOos.profit_factor >= 2 ? "text-gain" : "text-loss")}>{num(selOos.profit_factor)}</dd>
                      <dt className="text-muted-foreground">Avg R</dt><dd className="text-right">{num(selOos.avg_R)}</dd>
                    </dl>
                  ) : (
                    <p className="text-xs text-muted-foreground">Not in the latest backtest's most-selected list.</p>
                  )}
                </div>
                <p className="rounded-md bg-secondary p-3 text-xs text-muted-foreground">
                  Backtest stats are in-sample: they describe the window the strategy was chosen on. Out-of-sample results have historically been much worse.
                </p>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
