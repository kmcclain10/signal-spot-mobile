import { Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { AreaChart, Area, ResponsiveContainer, ReferenceLine, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowDown, ArrowUp, Pencil, Plus, X, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { getHomePortfolio, getPortfolioHistory, saveHomeWatchlist } from "@/lib/portfolio.functions";
import { portfolioRange, portfolioRefreshInterval, moveWatchSymbol, watchlistInput, type PortfolioRange } from "@/lib/portfolio-rules";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export const homePortfolioOptions = queryOptions({ queryKey: ["home-portfolio"], queryFn: () => getHomePortfolio(), staleTime: 3000, retry: false });
const cash = (v: number | null | undefined) => v == null || !Number.isFinite(v) ? "—" : v.toLocaleString("en-US", { style: "currency", currency: "USD" });
const signedCash = (v: number) => `${v >= 0 ? "+" : "−"}${cash(Math.abs(v))}`;
const percent = (v: number | null) => v == null ? "—" : `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;

export function HomePortfolio() {
  const [visible, setVisible] = useState(true);
  useEffect(() => { const update = () => setVisible(document.visibilityState === "visible"); update(); document.addEventListener("visibilitychange", update); return () => document.removeEventListener("visibilitychange", update); }, []);
  const { data, isRefetchError, refetch } = useSuspenseQuery({ ...homePortfolioOptions, refetchInterval: portfolioRefreshInterval(visible), refetchIntervalInBackground: false });
  const [range, setRange] = useState<PortfolioRange>("1D");
  const [scrub, setScrub] = useState<number | null>(null);
  const historyFn = useServerFn(getPortfolioHistory);
  const history = useQuery({ queryKey: ["portfolio-history", range], queryFn: () => historyFn({ data: range }), enabled: data.connected, refetchInterval: portfolioRefreshInterval(visible), refetchIntervalInBackground: false, retry: false });
  const points = history.data?.points ?? [];
  const point = scrub != null ? points[scrub] : undefined;
  const last = points.at(-1);
  const pnl = point?.pnl ?? (range === "1D" ? data.account?.dayPnl : last?.pnl);
  const pct = point?.pct != null ? point.pct * 100 : range === "1D" ? data.account?.dayPct : last?.pct != null ? last.pct * 100 : null;
  const positive = (pnl ?? 0) >= 0;
  if (!data.connected) return <section className="border-b py-8"><h2 className="text-xl font-semibold">Portfolio</h2><p className="my-4 text-sm text-muted-foreground">No Alpaca paper account connected.</p><Button asChild><Link to="/connections">Connect paper account</Link></Button><Watchlist data={data} /></section>;
  return <div className="space-y-8">
    <section aria-label="Portfolio equity" className="border-b pb-6">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground"><span className="flex items-center gap-1.5"><ShieldCheck className="size-3.5 text-gain" />Paper portfolio</span><span>{new Date(data.updatedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" })}</span></div>
      <h2 className="num break-words text-4xl font-semibold sm:text-5xl">{cash(point?.equity ?? data.account?.equity)}</h2>
      <div className={cn("num mt-2 flex flex-wrap items-center gap-2 text-sm", positive ? "text-gain" : "text-loss")}><span>{pnl != null ? signedCash(pnl) : "—"}</span><span>{pct != null ? `(${percent(pct)})` : ""}</span><span className="font-sans text-muted-foreground">{point ? new Date(point.timestamp * 1000).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : range === "1D" ? "Today" : range}</span></div>
      <div className="mt-5 h-56 w-full sm:h-64" aria-label={`${range} portfolio equity chart`}>
        {history.isPending ? <Skeleton className="h-full w-full" /> : history.isError || history.data?.error ? <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Portfolio history is unavailable right now.</div> : !points.length ? <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No portfolio history for this period.</div> : <ResponsiveContainer width="100%" height="100%"><AreaChart data={points} margin={{ top: 12, right: 2, bottom: 12, left: 2 }} onMouseMove={(state: { activeTooltipIndex?: number | string }) => { const index = Number(state.activeTooltipIndex); if (Number.isInteger(index) && index >= 0 && index < points.length) setScrub(index); }} onMouseLeave={() => setScrub(null)}>
          <XAxis dataKey="timestamp" hide /><YAxis hide domain={["dataMin", "dataMax"]} /><Tooltip content={() => null} />
          <Area type="linear" dataKey="equity" stroke={positive ? "var(--gain)" : "var(--loss)"} fill="var(--background)" strokeWidth={2} isAnimationActive={false} />
          {point && <ReferenceLine x={point.timestamp} stroke="var(--muted-foreground)" strokeDasharray="3 3" />}
        </AreaChart></ResponsiveContainer>}
      </div>
      {points.length > 0 && <input aria-label="Scrub portfolio history" type="range" min={0} max={points.length - 1} value={scrub ?? points.length - 1} onChange={e => setScrub(Number(e.target.value))} onBlur={() => setScrub(null)} className="my-2 h-3 w-full cursor-pointer accent-primary" />}
      <div className="grid grid-cols-7 gap-1" role="group" aria-label="Portfolio period">{portfolioRange.options.map(r => <Button key={r} size="sm" variant={r === range ? "secondary" : "ghost"} className={cn("px-0", r === range && "text-primary")} aria-pressed={r === range} onClick={() => { setRange(r); setScrub(null); }}>{r}</Button>)}</div>
      {isRefetchError && <div role="alert" className="mt-3 flex items-center justify-between gap-2 text-xs text-warning">Account refresh failed; showing your last snapshot.<Button variant="ghost" size="sm" onClick={() => refetch()}>Retry</Button></div>}
      <div className="mt-6 grid grid-cols-2 gap-4 border-t pt-5"><div><div className="text-xs text-muted-foreground">Stock buying power</div><p className="num mt-2 break-words text-lg font-semibold">{cash(data.account?.stockBuyingPower)}</p></div><div><div className="text-xs text-muted-foreground">Options buying power</div><p className="num mt-2 break-words text-lg font-semibold">{cash(data.account?.optionsBuyingPower)}</p></div></div>
    </section>
    <div className="grid gap-8 lg:grid-cols-2">
      <section><h2 className="mb-3 text-lg font-semibold">Positions <span className="num text-sm text-muted-foreground">{data.positions.length}</span></h2>{!data.positions.length ? <p className="border-y py-6 text-sm text-muted-foreground">No open positions</p> : data.positions.map(p => <div key={p.symbol} className="flex flex-wrap items-center justify-between gap-3 border-b py-4"><div className="min-w-0"><p className="break-all font-medium">{p.symbol}</p><p className="num mt-1 text-xs text-muted-foreground">{p.qty} {p.option ? "contracts" : "shares"} · {cash(p.price)}</p></div><div className={cn("num text-right text-sm", p.pnl >= 0 ? "text-gain" : "text-loss")}><p>{signedCash(p.pnl)}</p><p className="mt-1 text-xs">{percent(p.pct)}</p></div></div>)}<Button variant="link" className="mt-2 px-0" asChild><Link to="/trade">Manage positions</Link></Button></section>
      <Watchlist data={data} />
    </div>
  </div>;
}

function Watchlist({ data }: { data: Awaited<ReturnType<typeof getHomePortfolio>> }) {
  const [open, setOpen] = useState(false), [draft, setDraft] = useState<string[]>([]), [symbol, setSymbol] = useState(""), [busy, setBusy] = useState(false);
  const save = useServerFn(saveHomeWatchlist), qc = useQueryClient();
  const edit = () => { setDraft([...data.watchlist]); setSymbol(""); setOpen(true); };
  function add() {
    const next = [...draft, symbol.trim().toUpperCase()];
    const result = watchlistInput.safeParse(next);
    if (!result.success) { toast.error(draft.length >= 50 ? "Maximum 50 symbols" : draft.includes(symbol.trim().toUpperCase()) ? "Symbol is already on your watchlist" : "Enter a valid ticker"); return; }
    setDraft(result.data); setSymbol("");
  }
  return <section><div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-semibold">Watchlist <span className="num text-sm text-muted-foreground">{data.watchlist.length}</span></h2><Button variant="ghost" size="icon" aria-label="Edit watchlist" title="Edit watchlist" onClick={edit}><Pencil /></Button></div>
    {data.quoteError && <p className="mb-3 text-xs text-warning">Quotes are unavailable; your saved watchlist is unchanged.</p>}
    {!data.watchlist.length && <div className="border-y py-6"><p className="mb-3 text-sm text-muted-foreground">Your watchlist is empty</p><Button size="sm" variant="outline" onClick={edit}><Plus />Add symbol</Button></div>}
    {data.watchlist.map(symbol => { const q = data.quotes.find(q => q.symbol === symbol); return <div key={symbol} className="flex items-center justify-between gap-3 border-b py-4"><span className="font-semibold">{symbol}</span><div className="num text-right text-sm"><p>{cash(q?.price)}</p><p className={cn("mt-1 text-xs", q?.change == null ? "text-muted-foreground" : q.change >= 0 ? "text-gain" : "text-loss")}>{percent(q?.change ?? null)}</p></div></div>; })}
    <Sheet open={open} onOpenChange={v => { if (!busy) setOpen(v); }}><SheetContent className="flex flex-col"><SheetHeader><SheetTitle>Edit watchlist</SheetTitle><SheetDescription>{draft.length}/50 symbols</SheetDescription></SheetHeader>
      <form className="flex gap-2 px-4" onSubmit={e => { e.preventDefault(); add(); }}><Input aria-label="Watchlist symbol" placeholder="Symbol" value={symbol} autoCapitalize="characters" maxLength={10} onChange={e => setSymbol(e.target.value.toUpperCase())} /><Button size="icon" type="submit" aria-label="Add symbol" disabled={busy}><Plus /></Button></form>
      <div className="flex-1 overflow-y-auto px-4">{draft.map((s, i) => <div key={s} className="flex items-center justify-between border-b py-2"><span className="font-medium">{s}</span><div className="flex gap-1"><Button size="icon" variant="ghost" aria-label={`Move ${s} up`} disabled={i === 0 || busy} onClick={() => setDraft(moveWatchSymbol(draft, i, -1))}><ArrowUp /></Button><Button size="icon" variant="ghost" aria-label={`Move ${s} down`} disabled={i === draft.length - 1 || busy} onClick={() => setDraft(moveWatchSymbol(draft, i, 1))}><ArrowDown /></Button><Button size="icon" variant="ghost" aria-label={`Remove ${s}`} disabled={busy} onClick={() => setDraft(draft.filter(v => v !== s))}><X /></Button></div></div>)}</div>
      <div className="flex gap-2 border-t p-4"><Button variant="outline" className="flex-1" disabled={busy} onClick={() => setOpen(false)}>Cancel</Button><Button className="flex-1" disabled={busy} onClick={async () => { setBusy(true); try { await save({ data: draft }); await Promise.all([qc.invalidateQueries({ queryKey: ["home-portfolio"] }), qc.invalidateQueries({ queryKey: ["settings"] })]); setOpen(false); toast.success("Watchlist saved"); } catch(e) { toast.error(e instanceof Error ? e.message : "Save failed"); } finally { setBusy(false); } }}>{busy ? "Saving…" : "Save watchlist"}</Button></div>
    </SheetContent></Sheet>
  </section>;
}