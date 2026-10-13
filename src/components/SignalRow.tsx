import { Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { placeSignalOrder } from "@/lib/api.functions";
import { useSettings } from "@/hooks/use-app-data";
import { num, nyTime, positionSize, rewardRisk, usd } from "@/lib/format";
import { strategyName } from "@/lib/strategy-names";
import { nyDate } from "@/lib/market-hours";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SideBadge } from "@/components/common";

export type Signal = {
  id: string;
  trade_date: string;
  symbol: string;
  strategy_id: string;
  side: string;
  entry: number;
  stop: number;
  target: number | null;
  signal_time: string;
  status: string;
};

export function SignalRow({ s }: { s: Signal }) {
  const settings = useSettings();
  const qc = useQueryClient();
  const place = useServerFn(placeSignalOrder);
  const live = settings.data?.trading_mode === "live";
  const risk = Number(settings.data?.risk_per_trade_usd ?? 50);
  const qty = positionSize(risk, Number(s.entry), Number(s.stop));
  const rr = rewardRisk(s.side, Number(s.entry), Number(s.stop), s.target == null ? null : Number(s.target));
  const m = useMutation({
    mutationFn: () => place({ data: { signal_id: s.id } }),
    onSuccess: (r) => {
      toast.success(`${r.environment === "live" ? "Live" : "Paper"} order sent: ${r.side} ${r.qty} ${s.symbol}`);
      qc.invalidateQueries({ queryKey: ["signals"] });
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["broker"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Order failed"),
  });
  const tradable = s.status === "new" && s.trade_date === nyDate();

  return (
    <div className="flex flex-col gap-3 border-b px-4 py-3 last:border-0 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span className="num w-16 shrink-0 text-xs text-muted-foreground">{nyTime(s.signal_time)}</span>
        <span className="num w-14 shrink-0 font-semibold">{s.symbol}</span>
        <SideBadge side={s.side} />
        <span className="truncate text-xs text-muted-foreground">{strategyName(s.strategy_id)}</span>
      </div>
      <div className="num flex items-center gap-4 text-right text-xs">
        <div>
          <div className="text-muted-foreground">Entry</div>
          {num(s.entry)}
        </div>
        <div>
          <div className="text-muted-foreground">Stop</div>
          <span className="text-loss">{num(s.stop)}</span>
        </div>
        <div>
          <div className="text-muted-foreground">Target</div>
          <span className="text-gain">{s.target == null ? "close" : num(s.target)}</span>
        </div>
        <div>
          <div className="text-muted-foreground">R:R</div>
          {rr == null ? "—" : rr.toFixed(1)}
        </div>
      </div>
      <div className="sm:w-32 sm:text-right">
        {s.status === "ordered" ? (
          <Link to="/orders" className="inline-flex items-center gap-1 text-xs text-gain">
            Ordered <Check className="size-3" />
          </Link>
        ) : tradable ? (
          <Popover>
            <PopoverTrigger asChild>
              <Button size="sm" variant={live ? "destructive" : "default"} disabled={m.isPending}>
                {m.isPending ? "Sending…" : live ? "Live trade" : "Paper trade"}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-64">
              <div className="mb-3 text-sm font-medium">
                {s.side === "long" ? "Buy" : "Sell short"} {qty} {s.symbol}
              </div>
              <dl className="num grid grid-cols-2 gap-y-1 text-xs">
                <dt className="text-muted-foreground">Entry (market)</dt>
                <dd className="text-right">{num(s.entry)}</dd>
                <dt className="text-muted-foreground">Stop</dt>
                <dd className="text-right">{num(s.stop)}</dd>
                <dt className="text-muted-foreground">Target</dt>
                <dd className="text-right">{s.target == null ? "close" : num(s.target)}</dd>
                <dt className="text-muted-foreground">$ at risk</dt>
                <dd className="text-right">{usd(qty * Math.abs(Number(s.entry) - Number(s.stop)))}</dd>
              </dl>
              <Button className="mt-3 w-full" size="sm" variant={live ? "destructive" : "default"} onClick={() => m.mutate()}>
                Confirm {live ? "LIVE" : "paper"} order
              </Button>
            </PopoverContent>
          </Popover>
        ) : (
          <span className="text-xs capitalize text-muted-foreground">{s.status}</span>
        )}
      </div>
    </div>
  );
}
