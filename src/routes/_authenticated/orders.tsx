import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { providerProxy } from "@/lib/api.functions";
import { useBroker, useHasBroker } from "@/hooks/use-app-data";
import { nyDate } from "@/lib/market-hours";
import { num, signed, usd } from "@/lib/format";
import { EmptyState, ErrorState, LoadingRows, PageHeader, Panel, SideBadge } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/orders")({
  head: () => ({
    meta: [
      { title: "Orders & Positions — Pulse Signals" },
      { name: "description", content: "Open positions, orders and fills from your broker." },
      { property: "og:title", content: "Orders & Positions — Pulse Signals" },
      { property: "og:description", content: "Open positions, orders and fills from your broker." },
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

function OrdersPage() {
  const { hasBroker, loading } = useHasBroker();
  const qc = useQueryClient();
  const proxy = useServerFn(providerProxy);
  const positions = useBroker<any[]>("getPositions");
  const open = useBroker<any[]>("getOrders", ["open"]);
  const closed = useBroker<any[]>("getOrders", ["closed"]);
  const ours = useQuery({
    queryKey: ["orders", "ours"],
    queryFn: async () => {
      const { data, error } = await supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      return data;
    },
  });
  const act = useMutation({
    mutationFn: (v: { action: string; arg: string }) => proxy({ data: { capability: "broker", action: v.action, args: [v.arg] } }),
    onSuccess: () => {
      toast.success("Done");
      qc.invalidateQueries({ queryKey: ["broker"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });
  const today = nyDate();
  const fills = (closed.data ?? []).filter((o) => o.filledAt && nyDate(new Date(o.filledAt)) === today);

  if (loading) return <LoadingRows />;
  if (!hasBroker)
    return (
      <div>
        <PageHeader title="Orders & Positions" />
        <EmptyState title="No broker connected." body="Add an Alpaca paper account to see positions and orders." action={<Button asChild><Link to="/connections">Add connection</Link></Button>} />
      </div>
    );

  const list = (q: { isLoading: boolean; error: unknown; refetch: () => void }, rows: any[] | undefined, empty: string, render: (r: any) => React.ReactNode) =>
    q.isLoading ? <LoadingRows /> : q.error ? <ErrorState error={q.error} onRetry={q.refetch} /> : !rows?.length ? <EmptyState title={empty} /> : <Panel>{rows.map(render)}</Panel>;

  const row = "flex flex-wrap items-center gap-3 border-b px-4 py-3 text-sm last:border-0";

  return (
    <div>
      <PageHeader title="Orders & Positions" sub="Live from your default broker." />
      <Tabs defaultValue="positions">
        <TabsList className="grid h-auto w-full grid-cols-2 gap-1 sm:flex sm:w-fit">
          <TabsTrigger value="positions">Positions</TabsTrigger>
          <TabsTrigger value="open">Open orders</TabsTrigger>
          <TabsTrigger value="fills">Today's fills</TabsTrigger>
          <TabsTrigger value="sent">Sent by app</TabsTrigger>
        </TabsList>
        <TabsContent value="positions" className="mt-4">
          {list(positions, positions.data, "No open positions.", (p) => (
            <div key={p.symbol} className={row}>
              <span className="num w-16 font-semibold">{p.symbol}</span>
              <SideBadge side={p.qty >= 0 ? "long" : "short"} />
              <span className="num flex-1 text-right text-xs">{Math.abs(p.qty)} @ {num(p.avgPrice)} · now {num(p.currentPrice)}</span>
              <span className={cn("num w-24 text-right", p.unrealizedPl >= 0 ? "text-gain" : "text-loss")}>{signed(p.unrealizedPl)}</span>
              <Confirm label="Close" title={`Close ${p.symbol} position?`} onConfirm={() => act.mutate({ action: "closePosition", arg: p.symbol })} />
            </div>
          ))}
        </TabsContent>
        <TabsContent value="open" className="mt-4">
          {list(open, open.data, "No open orders.", (o) => (
            <div key={o.id} className={row}>
              <span className="num w-16 font-semibold">{o.symbol}</span>
              <SideBadge side={o.side} />
              <span className="num flex-1 text-right text-xs">{o.qty} · {o.type} · {o.orderClass || "simple"} · {o.status}</span>
              <Confirm label="Cancel" title={`Cancel ${o.symbol} order?`} onConfirm={() => act.mutate({ action: "cancelOrder", arg: o.id })} />
            </div>
          ))}
        </TabsContent>
        <TabsContent value="fills" className="mt-4">
          {list(closed, fills, "No fills today.", (o) => (
            <div key={o.id} className={row}>
              <span className="num w-16 font-semibold">{o.symbol}</span>
              <SideBadge side={o.side} />
              <span className="num flex-1 text-right text-xs">{o.filledQty} @ {num(o.filledAvgPrice)}</span>
            </div>
          ))}
        </TabsContent>
        <TabsContent value="sent" className="mt-4">
          {list(ours, ours.data, "No orders sent from the app yet.", (o) => (
            <div key={o.id} className={row}>
              <span className="num w-16 font-semibold">{o.symbol}</span>
              <SideBadge side={o.side} />
              <span className="num flex-1 text-right text-xs">
                {o.qty} · stop {num(o.stop)} · target {o.target == null ? "close" : num(o.target)} · {o.environment} · {new Date(o.created_at).toLocaleString()}
              </span>
              <span className="text-xs text-muted-foreground">{usd(Number(o.qty) * Math.abs(Number(o.entry) - Number(o.stop)))} risk</span>
            </div>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
