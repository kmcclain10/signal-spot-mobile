import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowDownRight, ArrowUpRight, Bot, Minus, Plus, RefreshCw, ShieldCheck, X } from "lucide-react";
import { getTradeDesk, getTicketQuote, placeManualTrade, cancelPaperOrder, closePaperPosition } from "@/lib/trade.functions";
import { ticketCost, type TradeTicket } from "@/lib/trade-rules";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

const desk = queryOptions({ queryKey: ["trade-desk"], queryFn: () => getTradeDesk(), refetchInterval: 10000 });
export const Route = createFileRoute("/_authenticated/trade")({
  validateSearch: z.object({ option: z.enum(["CALL", "PUT"]).optional() }),
  head: () => ({ meta: [{ title: "Trade — Pulse Signals" }, { name: "description", content: "Place paper stock, ETF and option trades, close positions and manage orders." },
    { property: "og:title", content: "Paper Trade Desk — Pulse Signals" }, { property: "og:description", content: "Manual paper trading on your Alpaca paper account." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(desk),
  component: TradePage,
  errorComponent: ({ error }) => <div className="p-6 text-sm text-muted-foreground">Could not load your paper account: {error instanceof Error ? error.message : "unknown error"}. Check Connections.</div>,
});
const cash = (v: number) => (Number.isFinite(v) ? v : 0).toLocaleString("en-US", { style: "currency", currency: "USD" });
const QUICK = ["IWM", "SPY", "QQQ", "AAPL", "TSLA", "NVDA"];

function TradePage() {
  const { data } = useSuspenseQuery(desk);
  const search = Route.useSearch();
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: desk.queryKey });
  const [tab, setTab] = useState(search.option ? "option" : "stock");
  const [symbol, setSymbol] = useState("IWM");
  return <div className="mx-auto max-w-5xl space-y-5">
    <header className="flex items-start justify-between gap-3">
      <div><div className="mb-1 flex items-center gap-2 text-xs text-gain"><ShieldCheck className="size-4" />PAPER ACCOUNT</div><h1 className="text-2xl font-semibold">Trade</h1></div>
      <Button size="icon" variant="ghost" aria-label="Refresh" onClick={refresh}><RefreshCw /></Button>
    </header>
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Stat label="Equity" value={cash(data.account.equity)} />
      <Stat label="Today" value={cash(data.account.day_pnl)} tone={data.account.day_pnl >= 0 ? "text-gain" : "text-loss"} />
      <Stat label="Buying power" value={cash(data.account.buying_power)} />
      <Stat label="Market" value={data.clock.is_open ? "Open" : "Closed"} tone={data.clock.is_open ? "text-gain" : "text-muted-foreground"} />
    </div>
    <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
      <section className="rounded-lg border bg-card p-4">
        <div className="mb-4 space-y-2"><Label htmlFor="sym">Symbol</Label>
          <Input id="sym" value={symbol} autoCapitalize="characters" onChange={e => setSymbol(e.target.value.toUpperCase().replace(/[^A-Z.]/g, "").slice(0, 10))} />
          <div className="flex flex-wrap gap-2">{QUICK.map(s => <Button key={s} type="button" size="sm" variant={s === symbol ? "secondary" : "ghost"} onClick={() => setSymbol(s)}>{s}</Button>)}</div>
        </div>
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full"><TabsTrigger value="stock" className="flex-1">Stock / ETF</TabsTrigger><TabsTrigger value="option" className="flex-1">Options</TabsTrigger></TabsList>
          <TabsContent value="stock"><StockTicket key={symbol} symbol={symbol} onDone={refresh} /></TabsContent>
          <TabsContent value="option"><OptionTicket key={symbol} symbol={symbol} initial={search.option ?? "CALL"} open={data.clock.is_open} level={data.account.options_level} onDone={refresh} /></TabsContent>
        </Tabs>
      </section>
      <div className="space-y-6">
        <Positions rows={data.positions} onDone={refresh} />
        <Orders title="Working orders" rows={data.open} cancel onDone={refresh} />
        <Orders title="Recent orders" rows={data.recent} onDone={refresh} />
      </div>
    </div>
  </div>;
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return <div className="rounded-lg border bg-card p-3"><div className="text-xs text-muted-foreground">{label}</div><div className={cn("num mt-1 font-semibold", tone)}>{value}</div></div>;
}

function Stepper({ value, set, max }: { value: number; set: (n: number) => void; max: number }) {
  return <div className="flex items-center gap-2">
    <Button type="button" size="icon" variant="outline" aria-label="Less" onClick={() => set(Math.max(1, value - 1))}><Minus /></Button>
    <Input aria-label="Quantity" inputMode="numeric" className="num w-20 text-center" value={value} onChange={e => set(Math.min(max, Math.max(1, Math.floor(Number(e.target.value) || 1))))} />
    <Button type="button" size="icon" variant="outline" aria-label="More" onClick={() => set(Math.min(max, value + 1))}><Plus /></Button>
  </div>;
}

function useSubmit(onDone: () => void) {
  const place = useServerFn(placeManualTrade);
  const [busy, setBusy] = useState(false);
  return { busy, async run(t: TradeTicket) {
    setBusy(true);
    try { const o = await place({ data: t }); toast.success(`Paper order ${o.status}: ${o.side} ${o.qty} ${o.symbol}`); onDone(); return true; }
    catch (e) { toast.error(e instanceof Error ? e.message : "Order failed"); return false; }
    finally { setBusy(false); }
  } };
}

function StockTicket({ symbol, onDone }: { symbol: string; onDone: () => void }) {
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [qty, setQty] = useState(1);
  const [type, setType] = useState<"market" | "limit">("market");
  const [limit, setLimit] = useState("");
  const [confirm, setConfirm] = useState(false);
  const quoteFn = useServerFn(getTicketQuote);
  const valid = /^[A-Z][A-Z.]{0,9}$/.test(symbol);
  const quote = useQuery({ queryKey: ["quote", symbol], queryFn: () => quoteFn({ data: { symbol } }), enabled: valid, refetchInterval: 5000 });
  const px = type === "limit" ? Number(limit) : (side === "buy" ? quote.data?.ask : quote.data?.bid) || quote.data?.last || 0;
  const { busy, run } = useSubmit(onDone);
  const ticket: TradeTicket = { kind: "stock", symbol, side, qty, type, ...(type === "limit" ? { limit_price: Number(limit) } : {}) };
  return <form className="space-y-4 pt-4" onSubmit={e => { e.preventDefault(); if (type === "limit" && !(Number(limit) > 0)) { toast.error("Enter a limit price"); return; } setConfirm(true); }}>
    <div className="num grid grid-cols-3 gap-2 text-center text-sm">
      {(["bid", "last", "ask"] as const).map(k => <div key={k} className="rounded border p-2"><div className="text-[10px] uppercase text-muted-foreground">{k}</div>{quote.data?.[k] ? quote.data[k].toFixed(2) : "—"}</div>)}
    </div>
    <div className="grid grid-cols-2 gap-2">
      <Button type="button" variant={side === "buy" ? "default" : "outline"} className={cn(side === "buy" && "bg-gain text-primary-foreground hover:bg-gain/90")} onClick={() => setSide("buy")}><ArrowUpRight />Buy</Button>
      <Button type="button" variant={side === "sell" ? "default" : "outline"} className={cn(side === "sell" && "bg-loss text-destructive-foreground hover:bg-loss/90")} onClick={() => setSide("sell")}><ArrowDownRight />Sell</Button>
    </div>
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="space-y-2"><Label>Shares</Label><Stepper value={qty} set={setQty} max={10000} /></div>
      <div className="space-y-2"><Label>Order type</Label><div className="flex gap-1">{(["market", "limit"] as const).map(t => <Button key={t} type="button" size="sm" variant={type === t ? "secondary" : "ghost"} onClick={() => setType(t)} className="capitalize">{t}</Button>)}</div></div>
    </div>
    {type === "limit" && <div className="space-y-2"><Label htmlFor="limit">Limit price</Label><Input id="limit" inputMode="decimal" value={limit} placeholder={quote.data?.last?.toFixed(2)} onChange={e => setLimit(e.target.value.replace(/[^0-9.]/g, ""))} /></div>}
    <div className="flex justify-between text-sm"><span className="text-muted-foreground">Estimated {side === "buy" ? "cost" : "proceeds"}</span><span className="num font-semibold">{px ? cash(ticketCost(px, qty, false)) : "—"}</span></div>
    <Button type="submit" className="w-full" size="lg" disabled={!valid || busy}>Review {side} order</Button>
    <Confirm open={confirm} setOpen={setConfirm} busy={busy} title={`${side === "buy" ? "Buy" : "Sell"} ${qty} ${symbol}`}
      body={`${type === "market" ? "Market" : `Limit $${Number(limit).toFixed(2)}`} • day order • about ${px ? cash(ticketCost(px, qty, false)) : "unknown"} • paper account`}
      onYes={async () => { if (await run(ticket)) setConfirm(false); }} />
  </form>;
}

function OptionTicket({ symbol, initial, open, level, onDone }: { symbol: string; initial: "CALL" | "PUT"; open: boolean; level: number; onDone: () => void }) {
  const [side, setSide] = useState<"CALL" | "PUT">(initial);
  const [contracts, setContracts] = useState(1);
  const [confirm, setConfirm] = useState(false);
  const quoteFn = useServerFn(getTicketQuote);
  const valid = /^[A-Z][A-Z.]{0,9}$/.test(symbol);
  const quote = useQuery({ queryKey: ["opt-quote", symbol, side], queryFn: () => quoteFn({ data: { symbol, option: side } }), enabled: open && valid, refetchInterval: 10000 });
  const c = quote.data?.contract;
  const { busy, run } = useSubmit(onDone);
  return <div className="space-y-4 pt-4">
    <h2 className="font-medium">{symbol || "Select a symbol"} options</h2>
    <div className="grid grid-cols-2 gap-2">
      <Button variant={side === "CALL" ? "default" : "outline"} className={cn(side === "CALL" && "bg-gain text-primary-foreground hover:bg-gain/90")} onClick={() => setSide("CALL")}><ArrowUpRight />Call</Button>
      <Button variant={side === "PUT" ? "default" : "outline"} className={cn(side === "PUT" && "bg-loss text-destructive-foreground hover:bg-loss/90")} onClick={() => setSide("PUT")}><ArrowDownRight />Put</Button>
    </div>
    {!open ? <p className="rounded border border-warning/40 bg-warning/10 p-3 text-sm text-warning">Options trade only while the market is open (9:30 AM–4:00 PM ET).</p>
      : level < 2 ? <p className="rounded border border-warning/40 bg-warning/10 p-3 text-sm text-warning">Your paper account needs options level 2 to buy options.</p>
      : <div className="rounded border p-3 text-sm">{!valid ? "Enter a valid symbol" : quote.isLoading ? "Finding contract…" : quote.isError ? `Could not load ${symbol} options. Try refreshing.` : c ? <><div className="font-medium">{symbol} ${c.strike} {side} • exp {c.expiry}</div><div className="num mt-1 text-muted-foreground">Bid {c.bid.toFixed(2)} • Ask {c.ask.toFixed(2)} • {symbol} {quote.data?.last.toFixed(2)}</div></> : `No ${symbol} contract with a fresh quote right now`}</div>}
    <div className="flex items-end justify-between gap-4"><div className="space-y-2"><Label>Contracts</Label><Stepper value={contracts} set={setContracts} max={50} /></div>
      <div className="text-right text-sm"><div className="text-muted-foreground">Estimated cost</div><div className="num font-semibold">{c ? cash(ticketCost(c.ask, contracts, true)) : "—"}</div></div></div>
    <Button className="w-full" size="lg" disabled={!valid || !open || level < 2 || !c || busy} onClick={() => setConfirm(true)}>Review {side.toLowerCase()} order</Button>
    <Confirm open={confirm} setOpen={setConfirm} busy={busy} title={`Buy ${contracts} ${symbol} ${side}${contracts > 1 ? "s" : ""}`}
      body={c ? `$${c.strike} strike, exp ${c.expiry} • limit at current ask • about ${cash(ticketCost(c.ask, contracts, true))} • paper account` : ""}
      onYes={async () => { if (await run({ kind: "option", symbol, side, contracts })) setConfirm(false); }} />
  </div>;
}

function Confirm({ open, setOpen, title, body, busy, onYes }: { open: boolean; setOpen: (v: boolean) => void; title: string; body: string; busy: boolean; onYes: () => void }) {
  return <AlertDialog open={open} onOpenChange={setOpen}><AlertDialogContent>
    <AlertDialogHeader><AlertDialogTitle>{title}</AlertDialogTitle><AlertDialogDescription>{body}</AlertDialogDescription></AlertDialogHeader>
    <AlertDialogFooter><AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel><AlertDialogAction disabled={busy} onClick={e => { e.preventDefault(); onYes(); }}>{busy ? "Sending…" : "Confirm"}</AlertDialogAction></AlertDialogFooter>
  </AlertDialogContent></AlertDialog>;
}

type Pos = Awaited<ReturnType<typeof getTradeDesk>>["positions"][number];
function Positions({ rows, onDone }: { rows: Pos[]; onDone: () => void }) {
  const close = useServerFn(closePaperPosition);
  const [target, setTarget] = useState<Pos | null>(null);
  const [busy, setBusy] = useState(false);
  return <section><h2 className="mb-2 font-medium">Positions</h2>
    {!rows.length && <p className="py-3 text-sm text-muted-foreground">No open positions</p>}
    {rows.map(p => <div key={p.symbol} className="flex items-center justify-between gap-3 border-b py-3">
      <div className="min-w-0"><div className="flex items-center gap-2 font-medium"><span className="truncate">{p.symbol}</span>{p.bot && <span className="flex items-center gap-1 rounded bg-secondary px-1.5 text-[10px] text-muted-foreground"><Bot className="size-3" />IWM bot</span>}</div>
        <div className="num text-xs text-muted-foreground">{p.qty} @ {p.avg_entry.toFixed(2)} • now {p.current.toFixed(2)}</div></div>
      <div className="flex items-center gap-2"><div className={cn("num text-right text-sm", p.pnl >= 0 ? "text-gain" : "text-loss")}>{cash(p.pnl)}<div className="text-xs">{p.pnl_pct.toFixed(1)}%</div></div>
        <Button size="sm" variant="outline" onClick={() => setTarget(p)}>Close</Button></div>
    </div>)}
    <Confirm open={!!target} setOpen={v => !v && setTarget(null)} busy={busy} title={`Close ${target?.symbol ?? ""}`}
      body={target?.bot ? "The IWM bot will sell this at market on its next check (within about a minute) and record it in the journal." : `Sell all ${target?.qty ?? ""} at market on your paper account.`}
      onYes={async () => { if (!target) return; setBusy(true);
        try { const r = await close({ data: { symbol: target.symbol } }); toast.success(r.viaBot ? "Close handed to the IWM bot" : "Close order sent"); setTarget(null); onDone(); }
        catch (e) { toast.error(e instanceof Error ? e.message : "Close failed"); } finally { setBusy(false); } }} />
  </section>;
}

type Ord = Awaited<ReturnType<typeof getTradeDesk>>["open"][number];
function Orders({ title, rows, cancel, onDone }: { title: string; rows: Ord[]; cancel?: boolean; onDone: () => void }) {
  const cancelFn = useServerFn(cancelPaperOrder);
  if (!rows.length && !cancel) return null;
  return <section><h2 className="mb-2 font-medium">{title}</h2>
    {!rows.length && <p className="py-3 text-sm text-muted-foreground">No working orders</p>}
    {rows.map(o => <div key={o.id} className="flex items-center justify-between gap-3 border-b py-2 text-sm">
      <div className="min-w-0"><div className="truncate"><span className={o.side === "buy" ? "text-gain" : "text-loss"}>{o.side.toUpperCase()}</span> {o.qty} {o.symbol}{o.bot && <span className="ml-2 text-[10px] text-muted-foreground">bot</span>}</div>
        <div className="num text-xs text-muted-foreground">{o.type}{o.limit_price ? ` ${o.limit_price.toFixed(2)}` : ""} • {o.status}{o.filled_avg_price ? ` @ ${o.filled_avg_price.toFixed(2)}` : ""} • {new Date(o.submitted_at).toLocaleTimeString("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit" })} ET</div></div>
      {cancel && !o.bot && <Button size="icon" variant="ghost" aria-label={`Cancel ${o.symbol}`} onClick={async () => { try { await cancelFn({ data: { id: o.id } }); toast.success("Order canceled"); onDone(); } catch (e) { toast.error(e instanceof Error ? e.message : "Cancel failed"); } }}><X /></Button>}
    </div>)}
  </section>;
}
