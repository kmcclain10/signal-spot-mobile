import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowDownRight, ArrowUpRight, Bot, Minus, Plus, RefreshCw, ShieldCheck, X } from "lucide-react";
import { getTradeDesk, getTicketQuote, placeManualTrade, cancelPaperOrder, closePaperPosition, getPaperOrder } from "@/lib/trade.functions";
import { ticketCost, stockTicket, orderStatus, type TradeTicket } from "@/lib/trade-rules";
import { Switch } from "@/components/ui/switch";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { tradeSearch } from "@/lib/explore-rules";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

const desk = queryOptions({ queryKey: ["trade-desk"], queryFn: () => getTradeDesk(), refetchInterval: 10000 });
export const Route = createFileRoute("/_authenticated/trade")({
  validateSearch: tradeSearch,
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
  const [symbol, setSymbol] = useState(search.symbol ?? "IWM");
  useEffect(() => { setSymbol(search.symbol ?? "IWM"); setTab(search.option ? "option" : "stock"); }, [search.symbol, search.option, search.side]);
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
      <section className="min-w-0 lg:border-r lg:pr-6">
        <div className="mb-4 space-y-2"><Label htmlFor="sym">Symbol</Label>
          <Input id="sym" value={symbol} autoCapitalize="characters" onChange={e => setSymbol(e.target.value.toUpperCase().replace(/[^A-Z.]/g, "").slice(0, 10))} />
          <div className="flex flex-wrap gap-2">{QUICK.map(s => <Button key={s} type="button" size="sm" variant={s === symbol ? "secondary" : "ghost"} onClick={() => setSymbol(s)}>{s}</Button>)}</div>
        </div>
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full"><TabsTrigger value="stock" className="flex-1">Stock / ETF</TabsTrigger><TabsTrigger value="option" className="flex-1">Options</TabsTrigger></TabsList>
          <TabsContent value="stock"><StockTicket key={`${symbol}-${search.side ?? "buy"}`} symbol={symbol} initial={search.side ?? "buy"} onDone={refresh} /></TabsContent>
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
  return <div className="min-w-0 border-b py-4"><div className="text-xs text-muted-foreground">{label}</div><div className={cn("num mt-2 break-words text-xl font-semibold", tone)}>{value}</div></div>;
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
    try { const o = await place({ data: t }); toast.success(`Paper order sent: ${o.side} ${o.notional ? cash(o.notional) : o.qty} ${o.symbol}`); onDone(); return o; }
    catch (e) { toast.error(e instanceof Error ? e.message : "Order failed"); return null; }
    finally { setBusy(false); }
  } };
}

const TYPES = [["market", "Market"], ["limit", "Limit"], ["stop", "Stop"], ["stop_limit", "Stop limit"]] as const;
type OType = typeof TYPES[number][0];
function StockTicket({ symbol, initial, onDone }: { symbol: string; initial: "buy" | "sell"; onDone: () => void }) {
  const [side, setSide] = useState<"buy" | "sell">(initial);
  const [mode, setMode] = useState<"shares" | "dollars">("shares");
  const [qty, setQty] = useState(1);
  const [dollars, setDollars] = useState("");
  const [type, setType] = useState<OType>("market");
  const [limit, setLimit] = useState("");
  const [stop, setStop] = useState("");
  const [tif, setTif] = useState<"day" | "gtc">("day");
  const [ext, setExt] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [placed, setPlaced] = useState<string | null>(null);
  const quoteFn = useServerFn(getTicketQuote);
  const valid = /^[A-Z][A-Z.]{0,9}$/.test(symbol);
  const quote = useQuery({ queryKey: ["quote", symbol], queryFn: () => quoteFn({ data: { symbol } }), enabled: valid, refetchInterval: 5000 });
  const dollarsMode = mode === "dollars";
  useEffect(() => { if (dollarsMode) { setType("market"); setTif("day"); setExt(false); } }, [dollarsMode]);
  useEffect(() => { if (type !== "limit" || tif !== "day") setExt(false); }, [type, tif]);
  const hasLimit = type === "limit" || type === "stop_limit", hasStop = type === "stop" || type === "stop_limit";
  const mkt = (side === "buy" ? quote.data?.ask : quote.data?.bid) || quote.data?.last || 0;
  const px = hasLimit ? Number(limit) : hasStop ? Number(stop) : mkt;
  const raw = { kind: "stock" as const, symbol, side, type, time_in_force: tif, extended_hours: ext,
    ...(dollarsMode ? { notional: Number(dollars) } : { qty }),
    ...(hasLimit ? { limit_price: Number(limit) || undefined } : {}), ...(hasStop ? { stop_price: Number(stop) || undefined } : {}) };
  const parsed = stockTicket.safeParse(raw);
  const problem = parsed.success ? null : parsed.error.issues[0]?.message;
  const est = dollarsMode ? Number(dollars) || 0 : px ? ticketCost(px, qty, false) : 0;
  const estShares = dollarsMode && mkt ? (Number(dollars) || 0) / mkt : null;
  const typeText = type === "market" ? "Market" : type === "limit" ? `Limit $${Number(limit).toFixed(2)}` : type === "stop" ? `Stop $${Number(stop).toFixed(2)}` : `Stop $${Number(stop).toFixed(2)} → limit $${Number(limit).toFixed(2)}`;
  const { busy, run } = useSubmit(onDone);
  const priceField = (id: string, label: string, v: string, set: (s: string) => void) => <div className="space-y-2"><Label htmlFor={id}>{label}</Label><Input id={id} inputMode="decimal" className="num" value={v} placeholder={quote.data?.last ? quote.data.last.toFixed(2) : "0.00"} onChange={e => set(e.target.value.replace(/[^0-9.]/g, ""))} /></div>;
  return <form className="space-y-4 pt-4" onSubmit={e => { e.preventDefault(); if (problem) { toast.error(problem); return; } setConfirm(true); }}>
    <div className="num grid grid-cols-3 gap-2 text-center text-sm">
      {(["bid", "last", "ask"] as const).map(k => <div key={k} className="rounded border p-2"><div className="text-[10px] uppercase text-muted-foreground">{k}</div>{quote.data?.[k] ? quote.data[k].toFixed(2) : "—"}</div>)}
    </div>
    <div className="grid grid-cols-2 gap-2">
      <Button type="button" variant={side === "buy" ? "default" : "outline"} className={cn(side === "buy" && "bg-gain text-primary-foreground hover:bg-gain/90")} onClick={() => setSide("buy")}><ArrowUpRight />Buy</Button>
      <Button type="button" variant={side === "sell" ? "default" : "outline"} className={cn(side === "sell" && "bg-loss text-destructive-foreground hover:bg-loss/90")} onClick={() => setSide("sell")}><ArrowDownRight />Sell</Button>
    </div>
    <div className="space-y-2"><Label>{side === "buy" ? "Buy in" : "Sell in"}</Label>
      <div className="flex gap-1">{(["shares", "dollars"] as const).map(m => <Button key={m} type="button" size="sm" variant={mode === m ? "secondary" : "ghost"} className="capitalize" onClick={() => setMode(m)}>{m}</Button>)}</div>
      {dollarsMode ? <div><Input aria-label="Dollar amount" inputMode="decimal" className="num" placeholder="$ amount (min $1)" value={dollars} onChange={e => setDollars(e.target.value.replace(/[^0-9.]/g, ""))} />
        <p className="mt-1 text-xs text-muted-foreground">Market day order. {estShares ? `About ${estShares.toFixed(4)} shares.` : ""} Only for stocks that allow fractional shares.</p></div>
        : <Stepper value={qty} set={setQty} max={10000} />}
    </div>
    <div className="space-y-2"><Label>Order type</Label>
      <div className="grid grid-cols-4 gap-1">{TYPES.map(([t, l]) => <Button key={t} type="button" size="sm" disabled={dollarsMode && t !== "market"} variant={type === t ? "secondary" : "ghost"} onClick={() => setType(t)}>{l}</Button>)}</div>
    </div>
    {(hasStop || hasLimit) && <div className="grid grid-cols-2 gap-3">{hasStop && priceField("stop", "Stop price", stop, setStop)}{hasLimit && priceField("limit", "Limit price", limit, setLimit)}</div>}
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="space-y-2"><Label>Good for</Label><div className="flex gap-1">{([["day", "Today"], ["gtc", "Until canceled"]] as const).map(([t, l]) => <Button key={t} type="button" size="sm" disabled={dollarsMode && t === "gtc"} variant={tif === t ? "secondary" : "ghost"} onClick={() => setTif(t)}>{l}</Button>)}</div></div>
      <label className="flex items-center gap-2 text-sm"><Switch checked={ext} disabled={type !== "limit" || tif !== "day"} onCheckedChange={setExt} />Extended hours</label>
    </div>
    <div className="flex justify-between text-sm"><span className="text-muted-foreground">Estimated {side === "buy" ? "cost" : "proceeds"}</span><span className="num font-semibold">{est ? cash(est) : "—"}</span></div>
    {problem && <p className="text-xs text-warning">{problem}</p>}
    <Button type="submit" className="w-full" size="lg" disabled={!valid || busy || !!problem}>Review {side} order</Button>
    <Confirm open={confirm} setOpen={setConfirm} busy={busy} title={`${side === "buy" ? "Buy" : "Sell"} ${dollarsMode ? cash(Number(dollars)) + " of" : qty} ${symbol}`}
      body={`${typeText} • ${tif === "day" ? "today only" : "good until canceled"}${ext ? " • extended hours" : ""} • about ${est ? cash(est) : "unknown"} • paper account`}
      onYes={async () => { if (!parsed.success) return; const o = await run(parsed.data); if (o) { setConfirm(false); setPlaced(o.id); } }} />
    <OrderSheet id={placed} onClose={() => setPlaced(null)} onDone={onDone} />
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
const toneClass = (t: string) => t === "gain" ? "text-gain" : t === "loss" ? "text-loss" : t === "warning" ? "text-warning" : "text-muted-foreground";
const etTime = (v: string | null) => v ? new Date(v).toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", second: "2-digit" }) + " ET" : null;
const typeLabel = (o: Ord) => o.type === "market" ? "market" : [o.stop_price ? `stop ${o.stop_price.toFixed(2)}` : "", o.limit_price ? `limit ${o.limit_price.toFixed(2)}` : ""].filter(Boolean).join(" → ") || o.type.replace("_", " ");

function OrderSheet({ id, onClose, onDone }: { id: string | null; onClose: () => void; onDone: () => void }) {
  const fn = useServerFn(getPaperOrder);
  const cancelFn = useServerFn(cancelPaperOrder);
  const q = useQuery({ queryKey: ["paper-order", id], queryFn: () => fn({ data: { id: id! } }), enabled: !!id,
    refetchInterval: (query) => { const o = query.state.data; return o && orderStatus(o.status, o.filled_qty, o.qty).done ? false : 2000; } });
  const o = q.data, st = o ? orderStatus(o.status, o.filled_qty, o.qty) : null;
  const steps = o ? [["Submitted", o.submitted_at], ["Filled", o.filled_at], ["Canceled", o.canceled_at], ["Expired", o.expired_at], ["Failed", o.failed_at]].filter(([, t]) => t) as [string, string][] : [];
  return <Sheet open={!!id} onOpenChange={v => !v && onClose()}><SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
    <SheetHeader><SheetTitle>{o ? `${o.side === "buy" ? "Buy" : "Sell"} ${o.notional ? cash(o.notional) + " of" : o.qty} ${o.symbol}` : "Order status"}</SheetTitle>
      <SheetDescription>Paper order{o?.bot ? " • managed by the IWM bot" : ""}</SheetDescription></SheetHeader>
    {q.isLoading ? <p className="p-4 text-sm text-muted-foreground">Loading order…</p> : q.isError ? <p className="p-4 text-sm text-loss">Could not load this order.</p> : o && st && <div className="space-y-4 p-4">
      <div className={cn("text-2xl font-semibold", toneClass(st.tone))}>{st.label}</div>
      {o.qty > 0 && <div><div className="h-2 overflow-hidden rounded bg-secondary"><div className="h-full bg-gain" style={{ width: `${Math.min(100, (o.filled_qty / o.qty) * 100)}%` }} /></div>
        <div className="num mt-1 text-xs text-muted-foreground">{o.filled_qty} of {o.qty} filled{o.filled_avg_price ? ` @ ${o.filled_avg_price.toFixed(2)}` : ""}</div></div>}
      <dl className="num grid grid-cols-2 gap-y-2 text-sm">
        <dt className="text-muted-foreground">Type</dt><dd className="text-right capitalize">{typeLabel(o)}</dd>
        <dt className="text-muted-foreground">Good for</dt><dd className="text-right">{o.time_in_force === "gtc" ? "Until canceled" : "Today"}{o.extended_hours ? " • ext. hours" : ""}</dd>
        {o.filled_avg_price != null && <><dt className="text-muted-foreground">Fill value</dt><dd className="text-right">{cash(o.filled_avg_price * o.filled_qty * (o.asset_class === "us_option" ? 100 : 1))}</dd></>}
      </dl>
      <ol className="space-y-2 border-l pl-4 text-sm">{steps.map(([l, t]) => <li key={l}><span className="font-medium">{l}</span> <span className="text-muted-foreground">{etTime(t)}</span></li>)}</ol>
      {!st.done && !o.bot && <Button variant="outline" className="w-full" onClick={async () => { try { await cancelFn({ data: { id: o.id } }); toast.success("Cancel requested"); q.refetch(); onDone(); } catch (e) { toast.error(e instanceof Error ? e.message : "Cancel failed"); } }}>Cancel order</Button>}
    </div>}
  </SheetContent></Sheet>;
}

function Orders({ title, rows, cancel, onDone }: { title: string; rows: Ord[]; cancel?: boolean; onDone: () => void }) {
  const cancelFn = useServerFn(cancelPaperOrder);
  const [open, setOpen] = useState<string | null>(null);
  if (!rows.length && !cancel) return null;
  return <section><h2 className="mb-2 font-medium">{title}</h2>
    {!rows.length && <p className="py-3 text-sm text-muted-foreground">No working orders</p>}
    {rows.map(o => { const st = orderStatus(o.status, o.filled_qty, o.qty); return <div key={o.id} className="flex items-center justify-between gap-3 border-b py-2 text-sm">
      <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setOpen(o.id)}><div className="truncate"><span className={o.side === "buy" ? "text-gain" : "text-loss"}>{o.side.toUpperCase()}</span> {o.notional ? cash(o.notional) : o.qty} {o.symbol}{o.bot && <span className="ml-2 text-[10px] text-muted-foreground">bot</span>}</div>
        <div className="num text-xs text-muted-foreground"><span className="capitalize">{typeLabel(o)}</span> • <span className={toneClass(st.tone)}>{st.label}</span>{o.filled_avg_price ? ` @ ${o.filled_avg_price.toFixed(2)}` : ""} • {new Date(o.submitted_at).toLocaleTimeString("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit" })} ET</div></button>
      {cancel && !o.bot && <Button size="icon" variant="ghost" aria-label={`Cancel ${o.symbol}`} onClick={async () => { try { await cancelFn({ data: { id: o.id } }); toast.success("Order canceled"); onDone(); } catch (e) { toast.error(e instanceof Error ? e.message : "Cancel failed"); } }}><X /></Button>}
    </div>; })}
    <OrderSheet id={open} onClose={() => setOpen(null)} onDone={onDone} />
  </section>;
}
