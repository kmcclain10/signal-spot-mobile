import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { importBundledBacktest } from "@/lib/api.functions";
import { useRealtimeInvalidate } from "@/hooks/use-app-data";
import { num, pct } from "@/lib/format";
import { EmptyState, ErrorState, LoadingRows, PageHeader, Panel, StatCard } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/performance")({
  head: () => ({
    meta: [
      { title: "Performance — Pulse Signals" },
      { name: "description", content: "Backtest versus out-of-sample results, equity curve and yearly breakdown." },
      { property: "og:title", content: "Performance — Pulse Signals" },
      { property: "og:description", content: "Backtest versus out-of-sample results, side by side." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PerformancePage,
});

function PerformancePage() {
  useRealtimeInvalidate("engine_runs", [["runs"]]);
  const qc = useQueryClient();
  const importFn = useServerFn(importBundledBacktest);
  const runs = useQuery({
    queryKey: ["runs", "backtests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("engine_runs")
        .select("*")
        .eq("kind", "backtest")
        .order("finished_at", { ascending: false, nullsFirst: true })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });
  const [runId, setRunId] = useState<string | null>(null);
  useEffect(() => {
    if (!runId && runs.data?.length) setRunId(runs.data[0].id);
  }, [runs.data, runId]);
  const run = runs.data?.find((r) => r.id === runId) ?? null;
  const imp = useMutation({
    mutationFn: () => importFn(),
    onSuccess: (r) => {
      setRunId(r.id);
      qc.invalidateQueries({ queryKey: ["runs"] });
      toast.success("Bundled backtest loaded");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Import failed"),
  });

  const s = (run?.summary ?? {}) as any;
  const equity = useMemo(() => {
    const e = run?.equity as any;
    if (!e?.dates) return [];
    let cum = 0;
    const out = e.dates.map((d: string, i: number) => ({ d, r: (cum += Number(e.daily_R[i] ?? 0)) }));
    const step = Math.max(1, Math.floor(out.length / 400));
    return out.filter((_: unknown, i: number) => i % step === 0 || i === out.length - 1);
  }, [run]);
  const min = Math.min(0, ...equity.map((x: any) => x.r));
  const max = Math.max(0, ...equity.map((x: any) => x.r));
  const zeroOffset = max === min ? 0 : max / (max - min);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Performance"
        sub="Out-of-sample is what actually happened the next day."
        action={
          runs.data?.length ? (
            <Select value={runId ?? undefined} onValueChange={setRunId}>
              <SelectTrigger className="w-60"><SelectValue placeholder="Select run" /></SelectTrigger>
              <SelectContent>
                {runs.data.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {new Date(r.finished_at ?? r.started_at).toLocaleString()} · {r.status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null
        }
      />
      <p className="text-xs text-muted-foreground">
        New backtests run on the engine server (<span className="num">python supabase_worker.py backtest</span>) and appear here automatically.
      </p>

      {runs.isLoading ? (
        <LoadingRows />
      ) : runs.error ? (
        <ErrorState error={runs.error} onRetry={() => runs.refetch()} />
      ) : !run ? (
        <EmptyState
          title="No backtest runs yet."
          body="Load the 2014–2020 backtest that ships with your engine, or run one on the engine server."
          action={<Button onClick={() => imp.mutate()} disabled={imp.isPending}>{imp.isPending ? "Loading…" : "Load bundled backtest"}</Button>}
        />
      ) : run.status === "running" ? (
        <EmptyState title="This backtest is still running." body="Results will appear when the engine finishes." />
      ) : run.status === "failed" ? (
        <ErrorState error={run.error ?? "This run failed."} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="OOS win rate" value={pct(s.oos?.win_rate)} tone={s.oos?.win_rate >= 0.6 ? "gain" : "loss"} hint={`${s.oos?.trades ?? 0} trades`} />
            <StatCard label="OOS profit factor" value={num(s.oos?.profit_factor)} tone={s.oos?.profit_factor >= 2 ? "gain" : "loss"} />
            <StatCard label="OOS avg R" value={num(s.oos?.avg_R)} tone={s.oos?.avg_R >= 0 ? "gain" : "loss"} />
            <StatCard label="Max drawdown" value={`${num(s.max_drawdown_R, 1)}R`} tone="loss" />
          </div>

          <Panel className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="px-4 py-2 text-left font-normal">Backtest vs. out-of-sample</th>
                  <th className="px-4 py-2 text-right font-normal">Picks in backtest</th>
                  <th className="px-4 py-2 text-right font-normal">Picks traded next day</th>
                  <th className="px-4 py-2 text-right font-normal">No selection</th>
                </tr>
              </thead>
              <tbody className="num">
                <tr className="border-b">
                  <td className="px-4 py-2 font-sans">Win rate</td>
                  {[s.in_sample?.avg_backtest_win_rate, s.oos?.win_rate, s.baseline?.win_rate].map((v, i) => (
                    <td key={i} className={cn("px-4 py-2 text-right", v >= 0.6 ? "text-gain" : "text-loss")}>{pct(v)}</td>
                  ))}
                </tr>
                <tr>
                  <td className="px-4 py-2 font-sans">Profit factor</td>
                  {[s.in_sample?.median_backtest_profit_factor, s.oos?.profit_factor, s.baseline?.profit_factor].map((v, i) => (
                    <td key={i} className={cn("px-4 py-2 text-right", v >= 2 ? "text-gain" : "text-loss")}>{num(v)}</td>
                  ))}
                </tr>
              </tbody>
            </table>
          </Panel>

          <Panel className="p-4">
            <div className="mb-3 text-sm font-semibold">Equity curve (cumulative R)</div>
            {equity.length ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={equity}>
                    <defs>
                      <linearGradient id="eqFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset={0} stopColor="var(--gain)" stopOpacity={0.4} />
                        <stop offset={zeroOffset} stopColor="var(--gain)" stopOpacity={0.05} />
                        <stop offset={zeroOffset} stopColor="var(--loss)" stopOpacity={0.05} />
                        <stop offset={1} stopColor="var(--loss)" stopOpacity={0.4} />
                      </linearGradient>
                      <linearGradient id="eqLine" x1="0" y1="0" x2="0" y2="1">
                        <stop offset={zeroOffset} stopColor="var(--gain)" />
                        <stop offset={zeroOffset} stopColor="var(--loss)" />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="d" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} minTickGap={60} />
                    <YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} width={40} />
                    <Tooltip
                      contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                      formatter={(v: number) => [`${v.toFixed(2)}R`, "Cumulative"]}
                    />
                    <Area type="monotone" dataKey="r" stroke="url(#eqLine)" fill="url(#eqFill)" strokeWidth={1.5} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No equity data in this run.</p>
            )}
          </Panel>

          <Panel className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  {["Year", "Trades", "Win rate", "PF", "Total R"].map((h, i) => (
                    <th key={h} className={cn("px-4 py-2 font-normal", i ? "text-right" : "text-left")}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="num">
                {Object.entries((run.by_year ?? {}) as Record<string, any>).map(([y, v]) => (
                  <tr key={y} className="border-b last:border-0">
                    <td className="px-4 py-2">{y}</td>
                    <td className="px-4 py-2 text-right">{v.trades}</td>
                    <td className="px-4 py-2 text-right">{v.trades ? pct(v.win_rate) : "—"}</td>
                    <td className="px-4 py-2 text-right">{v.trades ? num(v.profit_factor) : "—"}</td>
                    <td className={cn("px-4 py-2 text-right", v.total_R >= 0 ? "text-gain" : "text-loss")}>{v.trades ? num(v.total_R, 1) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        </>
      )}
    </div>
  );
}
