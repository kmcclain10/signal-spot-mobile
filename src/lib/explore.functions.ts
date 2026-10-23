import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { quoteSymbol, quoteRange, quoteBarParams, safeNewsUrl, type Asset } from "@/lib/explore-rules";
type Rec = Record<string, any>;
async function apiFor(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { iwmAlpaca } = await import("@/lib/server/iwm-alpaca.server");
  return iwmAlpaca(supabaseAdmin, userId);
}
function assetDto(a: Rec): Asset { return { symbol: String(a.symbol), name: String(a.name ?? a.symbol), tradable: !!a.tradable && a.status === "active", optionable: (a.attributes ?? []).includes("has_options"), fractionable: !!a.fractionable, shortable: !!a.shortable, exchange: String(a.exchange ?? "") }; }
export const getExploreAssets = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  try { const api = await apiFor(context.userId); const assets: Rec[] = await api.call("/v2/assets?status=active&asset_class=us_equity"); return { assets: assets.filter(a => a.tradable).map(assetDto), error: null }; }
  catch { return { assets: [], error: "Connect an Alpaca paper account to search tradable stocks and ETFs." }; }
});
export const getExploreLists = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const [settings, state, picks] = await Promise.all([
    context.supabase.from("iwm_strategy_settings").select("enabled").eq("user_id", context.userId).maybeSingle(),
    context.supabase.from("iwm_strategy_state").select("last_run_at,pnl_today,trades_today,last_error,needs_review,open_trade,trading_day").eq("user_id", context.userId).maybeSingle(),
    context.supabase.from("picks").select("id,strategy_id,trade_date,bt_win_rate").eq("user_id", context.userId).order("trade_date", { ascending: false }).limit(10),
  ]);
  let movers: { gainers: Rec[]; losers: Rec[]; last_updated?: string } | null = null, active: { most_actives: Rec[]; last_updated?: string } | null = null;
  try { const api = await apiFor(context.userId); [movers, active] = await Promise.all([
    api.call("/v1beta1/screener/stocks/movers?top=10", "GET", undefined, true).catch(() => null),
    api.call("/v1beta1/screener/stocks/most-actives?by=volume&top=10", "GET", undefined, true).catch(() => null),
  ]); } catch { /* Keep owner's bot status and picks accessible without a broker. */ }
  const mapMover = (r: Rec) => ({ symbol: String(r.symbol), price: Number(r.price), change: Number(r.percent_change) });
  return { gainers: (movers?.gainers ?? []).map(mapMover), losers: (movers?.losers ?? []).map(mapMover), active: (active?.most_actives ?? []).map((r: Rec) => ({ symbol: String(r.symbol), volume: Number(r.volume), trades: Number(r.trade_count) })), moversUnavailable: !movers, activeUnavailable: !active, marketAt: movers?.last_updated ?? active?.last_updated ?? null, picks: picks.data ?? [], iwm: { enabled: !!settings.data?.enabled, state: state.data } };
});
export const getStockQuote = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator(i => quoteSymbol.parse(i)).handler(async ({ data, context }) => {
  const api = await apiFor(context.userId);
  const [asset, snapshot, news] = await Promise.all([
    api.call(`/v2/assets/${encodeURIComponent(data)}`).catch(() => null),
    api.call(`/v2/stocks/${encodeURIComponent(data)}/snapshot?feed=iex`, "GET", undefined, true).catch(() => null),
    api.call(`/v1beta1/news?${new URLSearchParams({ symbols: data, limit: "8", sort: "desc" })}`, "GET", undefined, true).catch(() => null),
  ]);
  const price = Number(snapshot?.latestTrade?.p ?? snapshot?.dailyBar?.c), previous = Number(snapshot?.prevDailyBar?.c);
  return { asset: asset ? assetDto(asset) : null, symbol: data, price: price > 0 && Number.isFinite(price) ? price : null, change: price > 0 && previous > 0 ? price - previous : null, percent: price > 0 && previous > 0 ? (price / previous - 1) * 100 : null,
    time: snapshot?.latestTrade?.t ?? snapshot?.dailyBar?.t ?? null, bid: snapshot?.latestQuote?.bp ?? null, ask: snapshot?.latestQuote?.ap ?? null,
    open: snapshot?.dailyBar?.o ?? null, high: snapshot?.dailyBar?.h ?? null, low: snapshot?.dailyBar?.l ?? null, previous: previous > 0 ? previous : null, volume: snapshot?.dailyBar?.v ?? null,
    news: ((news?.news ?? []) as Rec[]).flatMap((n: Rec) => { const url = safeNewsUrl(String(n.url)); return url ? [{ id: String(n.id), title: String(n.headline), source: String(n.source), at: String(n.created_at), url }] : []; }), newsUnavailable: news === null, quoteUnavailable: snapshot === null };
});
export const getQuoteBars = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator(i => z.object({ symbol: quoteSymbol, range: quoteRange }).parse(i)).handler(async ({ data, context }) => {
  const api = await apiFor(context.userId);
  try {
    const params = quoteBarParams(data.range, new Date()); let token: string | undefined; const bars: { t: string; o: number; h: number; l: number; c: number; v: number }[] = [];
    for (let page = 0; page < 5; page++) { const result = await api.call(`/v2/stocks/${encodeURIComponent(data.symbol)}/bars?${new URLSearchParams({ ...params, ...(token ? { page_token: token } : {}) })}`, "GET", undefined, true); bars.push(...(result.bars ?? []).filter((b: Rec) => [b.o,b.h,b.l,b.c].every(Number.isFinite)).map((b: Rec) => ({ t: String(b.t), o: Number(b.o), h: Number(b.h), l: Number(b.l), c: Number(b.c), v: Number(b.v) }))); token = result.next_page_token; if (!token) break; }
    const latestDay = bars.at(-1)?.t.slice(0, 10); return { bars: data.range === "1D" ? bars.filter(b => b.t.slice(0,10) === latestDay) : bars, error: null, truncated: !!token };
  } catch { return { bars: [], error: "Price history is unavailable for this period.", truncated: false }; }
});