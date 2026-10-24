import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { Bell, BellOff, Download } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { providerProxy } from "@/lib/api.functions";
import { useBroker, useHasBroker } from "@/hooks/use-app-data";
import { useBotNotifications } from "@/hooks/use-bot-notifications";
import { activityCsv, buildActivity, filterActivity, type ActivityFilter, type ActivityItem } from "@/lib/activity-rules";
import { nyDate } from "@/lib/market-hours";
import { num, signed } from "@/lib/format";
import { EmptyState, ErrorState, LoadingRows, PageHeader, Panel, SideBadge } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/orders")({
  head: () => ({
    meta: [
      { title: "Activity — Pulse Signals" },
      { name: "description", content: "One feed of your fills, orders and bot trades, with positions, exports and notifications." },
      { property: "og:title", content: "Activity — Pulse Signals" },
      { property: "og:description", content: "Unified trading activity feed with CSV export." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OrdersPage,
});

function Confirm({ label, title, onConfirm }: { label: string; title: string; onConfirm: () => void }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant="outline">{label}</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>This is sent to your broker immediately.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Confirm</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

const KIND_LABEL: Record<ActivityItem["kind"], string> = {
  fill: "Fill", order: "Order", "bot-entry": "Bot entry", "bot-exit": "Bot exit", "bot-bank": "Banked",
};
const KIND_TONE: Record<ActivityItem["kind"], string> = {
  fill: "text-foreground", order: "text-muted-foreground", "bot-entry": "text-gain", "bot-exit": "text-warning", "bot-bank": "text-banked",
};
const FILTERS: { id: ActivityFilter; label: string }[] = [
  { id: "all", label: "All" }, { id: "trades", label: "Fills" }, { id: "bot", label: "Bot" }, { id: "orders", label: "Orders" },
];

function OrdersPage() {
  const { hasBroker, loading } = useHasBroker();
  const qc = useQueryClient();
  const user = Route.useRouteContext().user;
  const proxy = useServerFn(providerProxy);
  const positions = useBroker<any[]>("getPositions");
  const open = useBroker<any[]>("getOrders", ["open"]);
  const closed = useBroker<any[]>("getOrders", ["closed"]);
  const [filter, setFilter] = useState<ActivityFilter>("all");
  const notifications = useBotNotifications(user.id);

  const ours = useQuery({
    queryKey: ["orders", "ours"],
    queryFn: async () => {
      const { data, error } = await supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      return data;
    },
  });
  const botEvents = useQuery({
    queryKey: ["activity", "bot"],
    queryFn: async () => {
      const [trades, banks] = await Promise.all([
        supabase.from("iwm_trades").select("id,strike,side,contracts,entry_premium,entry_time,exit_time,exit_reason,pnl").order("entry_time", { ascending: false }).limit(100),
        supabase.from("iwm_bank_events").select("id,amount_banked,new_cycle,restart_balance,created_at").order("created_at", { ascending: false }).limit(50),
      ]);
      if (trades.error || banks.error) throw trades.error ?? banks.error;
      return { trades: trades.data ?? [], banks: banks.data ?? [] };
    },
  });

  const act = useMutation({
    mutationFn: (v: { action: string; arg: string }) => proxy({ data: { capability: "broker", action: v.action, args: [v.arg] } }),
    onSuccess: () => { toast.success("Done"); qc.invalidateQueries({ queryKey: ["broker"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const feed = useMemo(
    () => buildActivity({ fills: closed.data ?? [], sent: ours.data ?? [], botTrades: botEvents.data?.trades ?? [], botBanks: botEvents.data?.banks ?? [] }),
    [closed.data, ours.data, botEvents.data],
  );
  const shown = useMemo(() => filterActivity(feed, filter), [feed, filter]);

  function exportCsv() {
    const blob = new Blob([activityCsv(shown)], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `activity_${nyDate()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Activity exported");
  }

  if (loading) return <LoadingRows />;
  if (!hasBroker)
    return (
      <div>
        <PageHeader title="Activity" />
        <EmptyState title="No broker connected." body="Add an Alpaca paper account to see positions and orders." action={<Button asChild><Link to="/connections">Add connection</Link></Button>} />
      </div>
    );

  const row = "flex flex-wrap items-center gap-3 border-b px-4 py-3 text-sm last:border-0";

  return (
    <div className="space-y-8">
      <PageHeader title="Activity" sub="Everything your account and bot did, in one place." />

      <section className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-4">
        <div className="flex items-center gap-3">
          {notifications.enabled ? <Bell className="size-5 text-primary" /> : <BellOff className="size-5 text-muted-foreground" />}
          <div>
            <Label htmlFor="bot-notify" className="text-sm font-medium">Bot trade notifications</Label>
            <p className="text-xs text-muted-foreground">
              {notifications.supported ? "Browser alerts when the bot enters a trade or banks profits. This device only." : "This browser doesn't support notifications."}
            </p>
          </div>
        </div>
        <Switch id="bot-notify" checked={notifications.enabled} disabled={!notifications.supported} onCheckedChange={async (v) => { const ok = await notifications.toggle(v); if (!ok && v) toast.error("Notifications were not allowed by the browser"); }} />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium">Open positions</h2>
        {positions.isLoading ? <LoadingRows /> : positions.error ? <ErrorState error={positions.error} onRetry={positions.refetch} /> : !positions.data?.length ? <EmptyState title="No open positions." /> : (
          <Panel>{positions.data.map((p) => (
            <div key={p.symbol} className={row}>
              <span className="num w-16 font-semibold">{p.symbol}</span>
              <SideBadge side={p.qty >= 0 ? "long" : "short"} />
              <span className="num flex-1 text-right text-xs">{Math.abs(p.qty)} @ {num(p.avgPrice)} · now {num(p.currentPrice)}</span>
              <span className={cn("num w-24 text-right", p.unrealizedPl >= 0 ? "text-gain" : "text-loss")}>{signed(p.unrealizedPl)}</span>
              <Confirm label="Close" title={`Close ${p.symbol} position?`} onConfirm={() => act.mutate({ action: "closePosition", arg: p.symbol })} />
            </div>
          ))}</Panel>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium">Working orders</h2>
        {open.isLoading ? <LoadingRows /> : open.error ? <ErrorState error={open.error} onRetry={open.refetch} /> : !open.data?.length ? <EmptyState title="No open orders." /> : (
          <Panel>{open.data.map((o) => (
            <div key={o.id} className={row}>
              <span className="num w-16 font-semibold">{o.symbol}</span>
              <SideBadge side={o.side} />
              <span className="num flex-1 text-right text-xs">{o.qty} · {o.type} · {o.orderClass || "simple"} · {o.status}</span>
              <Confirm label="Cancel" title={`Cancel ${o.symbol} order?`} onConfirm={() => act.mutate({ action: "cancelOrder", arg: o.id })} />
            </div>
          ))}</Panel>
        )}
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-medium">Feed</h2>
          <div className="flex items-center gap-2">
            {FILTERS.map((f) => (
              <button key={f.id} onClick={() => setFilter(f.id)} className={cn("rounded-full border px-3 py-1 text-xs transition-colors", filter === f.id ? "border-primary bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground")}>{f.label}</button>
            ))}
            <Button size="sm" variant="outline" disabled={!shown.length} onClick={exportCsv}><Download />CSV</Button>
          </div>
        </div>
        {!shown.length ? <EmptyState title="Nothing here yet." body="Fills, app orders and bot trades will appear as they happen." /> : (
          <Panel className="max-h-[60vh] overflow-y-auto">
            {shown.map((i) => (
              <div key={i.id} className={row}>
                <span className={cn("w-20 shrink-0 text-xs font-semibold", KIND_TONE[i.kind])}>{KIND_LABEL[i.kind]}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{i.title}</span>
                  <span className="block text-xs text-muted-foreground">{i.detail}</span>
                </span>
                {i.amount != null && <span className={cn("num text-sm", i.amount >= 0 ? "text-gain" : "text-loss")}>{signed(i.amount)}</span>}
                <span className="num text-xs text-muted-foreground">{new Date(i.at).toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
              </div>
            ))}
          </Panel>
        )}
      </section>
    </div>
  );
}
