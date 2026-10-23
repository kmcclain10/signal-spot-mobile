import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Search, X, Activity, ArrowRight } from "lucide-react";
import { getExploreAssets, getExploreLists } from "@/lib/explore.functions";
import { filterAssets, rememberSymbol } from "@/lib/explore-rules";
import { strategySetup } from "@/lib/strategy-names";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
const assetsOptions = queryOptions({ queryKey: ["explore-assets"], queryFn: () => getExploreAssets(), staleTime: 3600000 });
const listsOptions = queryOptions({ queryKey: ["explore-lists"], queryFn: () => getExploreLists(), staleTime: 30000 });
export const Route = createFileRoute("/_authenticated/explore")({
  head: () => ({ meta: [{ title: "Explore Stocks & ETFs — Pulse Signals" }, { name: "description", content: "Search tradable stocks and ETFs, view movers, most-active stocks, strategy picks and IWM status." }, { property: "og:title", content: "Explore Stocks & ETFs — Pulse Signals" }, { property: "og:description", content: "Stock search, market lists and paper strategy picks." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  loader: async ({ context }) => { await Promise.all([context.queryClient.ensureQueryData(assetsOptions), context.queryClient.ensureQueryData(listsOptions)]); }, component: ExplorePage,
});
function ExplorePage() {
  const { data } = useSuspenseQuery(assetsOptions), { data: lists } = useSuspenseQuery({ ...listsOptions, refetchInterval: 30000 });
  const userId = Route.useRouteContext().user.id, key = `recent-stocks-${userId}`;
  const [search, setSearch] = useState(""), [recent, setRecent] = useState<string[]>([]);
  useEffect(() => { try { const stored = JSON.parse(localStorage.getItem(key) ?? "[]"); if (Array.isArray(stored)) setRecent(stored.filter(s => typeof s === "string" && /^[A-Z][A-Z.]{0,9}$/.test(s)).slice(0,8)); } catch { /* Invalid local history ignored. */ } }, [key]);
  const remember = (symbol: string) => { const next = rememberSymbol(recent, symbol); setRecent(next); localStorage.setItem(key, JSON.stringify(next)); };
  const rows = filterAssets(data.assets, search);
  return <div className="space-y-7"><header className="flex items-center justify-between gap-3"><h1 className="text-3xl font-semibold">Explore</h1><Button variant="link" asChild><Link to="/signals">Signals<ArrowRight /></Link></Button></header>
    <div className="relative"><Search className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground" /><Input aria-label="Search stocks and ETFs" placeholder="Search symbol or company" className="h-11 pl-10 pr-10" value={search} onChange={e => setSearch(e.target.value)} />{search && <Button size="icon" variant="ghost" className="absolute right-1 top-1" aria-label="Clear search" onClick={() => setSearch("")}><X /></Button>}</div>
    {data.error && <p className="text-sm text-warning">{data.error}</p>}
    {search.trim() ? <section aria-label="Search results"><h2 className="mb-2 text-sm text-muted-foreground">{rows.length} matches</h2>{!rows.length && <p className="border-y py-6 text-sm text-muted-foreground">No tradable stocks or ETFs match.</p>}{rows.map(a => <Link key={a.symbol} to="/quote/$symbol" params={{ symbol: a.symbol }} onClick={() => remember(a.symbol)} className="flex items-center justify-between gap-3 border-b py-4"><div className="min-w-0"><p className="font-semibold">{a.symbol}</p><p className="mt-1 truncate text-xs text-muted-foreground">{a.name}</p></div><ArrowRight className="size-4 shrink-0 text-muted-foreground" /></Link>)}</section> : <>
      {recent.length > 0 && <section><div className="mb-2 flex items-center justify-between"><h2 className="text-sm text-muted-foreground">Recent searches</h2><Button variant="ghost" size="sm" onClick={() => { setRecent([]); localStorage.removeItem(key); }}>Clear</Button></div><div className="flex flex-wrap gap-2">{recent.map(symbol => <Button key={symbol} asChild variant="secondary" size="sm"><Link to="/quote/$symbol" params={{ symbol }} onClick={() => remember(symbol)}>{symbol}</Link></Button>)}</div></section>}
      <section className="border-y py-4"><Link to="/iwm" className="flex items-center justify-between gap-3"><div><h2 className="flex items-center gap-2 font-semibold"><Activity className="size-4 text-primary" />IWM 20-Min Window</h2><p className="mt-2 text-xs text-muted-foreground">PAPER · {lists.iwm.state?.needs_review ? "Needs review" : lists.iwm.state?.last_error ? "Check required" : lists.iwm.enabled ? "Enabled" : "Disabled"}{lists.iwm.state?.last_run_at ? ` · checked ${new Date(lists.iwm.state.last_run_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : ""}</p></div><ArrowRight className="size-4 shrink-0" /></Link></section>
      <Tabs defaultValue="movers"><TabsList className="grid w-full grid-cols-3"><TabsTrigger value="movers">Movers</TabsTrigger><TabsTrigger value="active">Most active</TabsTrigger><TabsTrigger value="picks">Pulse picks</TabsTrigger></TabsList>
        <TabsContent value="movers" className="space-y-5 pt-3">{lists.moversUnavailable ? <p className="border-y py-6 text-sm text-muted-foreground">Market-wide movers are unavailable on your data connection.</p> : <>{[ ["Gainers", lists.gainers], ["Losers", lists.losers] ] .map(([label, values]) => <section key={String(label)}><h2 className="mb-2 font-medium">{String(label)}</h2>{(values as typeof lists.gainers).map(r => <MarketRow key={r.symbol} symbol={r.symbol} value={Number.isFinite(r.price) ? `$${r.price.toFixed(2)}` : "—"} sub={`${r.change >= 0 ? "+" : ""}${r.change.toFixed(2)}%`} positive={r.change >= 0} remember={remember} />)}</section>)}</>}</TabsContent>
        <TabsContent value="active" className="pt-3">{lists.activeUnavailable ? <p className="border-y py-6 text-sm text-muted-foreground">Market-wide activity is unavailable on your data connection.</p> : lists.active.map(r => <MarketRow key={r.symbol} symbol={r.symbol} value={r.volume.toLocaleString()} sub="shares traded" remember={remember} />)}</TabsContent>
        <TabsContent value="picks" className="pt-3">{!lists.picks.length ? <p className="border-y py-6 text-sm text-muted-foreground">No strategy picks yet.</p> : lists.picks.map(p => <Link key={p.id} to="/signals" className="block border-b py-4"><p className="font-medium">{strategySetup(p.strategy_id)}</p><p className="mt-2 text-xs text-muted-foreground">{p.trade_date} · backtest win rate {(Number(p.bt_win_rate) * 100).toFixed(1)}%</p></Link>)}</TabsContent>
      </Tabs>{lists.marketAt && <p className="text-xs text-muted-foreground">Market lists updated {new Date(lists.marketAt).toLocaleString()}</p>}
    </>}
  </div>;
}
function MarketRow({ symbol, value, sub, positive, remember }: { symbol: string; value: string; sub: string; positive?: boolean; remember: (s: string) => void }) { return <Link to="/quote/$symbol" params={{ symbol }} onClick={() => remember(symbol)} className="flex items-center justify-between border-b py-4"><span className="font-semibold">{symbol}</span><div className="num text-right text-sm"><p>{value}</p><p className={cn("mt-1 text-xs", positive == null ? "text-muted-foreground" : positive ? "text-gain" : "text-loss")}>{sub}</p></div></Link>; }