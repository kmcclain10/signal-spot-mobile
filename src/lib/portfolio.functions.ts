import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { portfolioRange, watchlistInput, historyParams, equityPoints } from "@/lib/portfolio-rules";

async function paperApi(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { iwmAlpaca } = await import("@/lib/server/iwm-alpaca.server");
  return iwmAlpaca(supabaseAdmin, userId);
}

export const getHomePortfolio = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { data: connections, error: connectionError } = await context.supabase.from("connections").select("id").eq("user_id", context.userId).eq("provider", "alpaca").eq("environment", "paper").limit(1);
  if (connectionError) throw new Error("Could not read your paper connection");
  const { data: settings, error } = await context.supabase.from("settings").select("watchlist").eq("user_id", context.userId).maybeSingle();
  if (error) throw new Error("Could not load your watchlist");
  const watchlist = settings?.watchlist ?? [];
  if (!connections?.length) return { connected: false, account: null, positions: [], quotes: [], watchlist, quoteError: false, updatedAt: new Date().toISOString() };
  const api = await paperApi(context.userId);
  const [a, positions, snapshots] = await Promise.all([
    api.account(), api.positions(),
    watchlist.length ? api.call(`/v2/stocks/snapshots?${new URLSearchParams({ symbols: watchlist.join(","), feed: "iex" })}`, "GET", undefined, true).catch(() => null) : Promise.resolve({}),
  ]);
  return {
    connected: true,
    account: { equity: Number(a.equity), dayPnl: Number(a.equity) - Number(a.last_equity), dayPct: Number(a.last_equity) > 0 ? (Number(a.equity) / Number(a.last_equity) - 1) * 100 : null,
      stockBuyingPower: Number(a.buying_power), optionsBuyingPower: a.options_buying_power != null ? Number(a.options_buying_power) : null },
    positions: positions.map(p => ({ symbol: String(p.symbol), qty: Number(p.qty), option: p.asset_class === "us_option", price: Number(p.current_price), pnl: Number(p.unrealized_pl), pct: Number(p.unrealized_plpc) * 100 })),
    quotes: watchlist.map(symbol => { const s = snapshots?.[symbol]; const price = Number(s?.latestTrade?.p ?? s?.dailyBar?.c); const previous = Number(s?.prevDailyBar?.c); return { symbol, price: Number.isFinite(price) && price > 0 ? price : null, change: price > 0 && previous > 0 ? (price / previous - 1) * 100 : null }; }),
    watchlist, quoteError: snapshots === null, updatedAt: new Date().toISOString(),
  };
});

export const getPortfolioHistory = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator(i => portfolioRange.parse(i)).handler(async ({ data, context }) => {
  const api = await paperApi(context.userId);
  const account = data === "ALL" ? await api.account() : null;
  const params = historyParams(data, new Date(), account?.created_at);
  try { return { points: equityPoints(await api.call(`/v2/account/portfolio/history?${new URLSearchParams(params)}`)), error: null }; }
  catch { return { points: [], error: "Portfolio history is unavailable right now." }; }
});

export const saveHomeWatchlist = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator(i => watchlistInput.parse(i)).handler(async ({ data, context }) => {
  const { error } = await context.supabase.from("settings").upsert({ user_id: context.userId, watchlist: data, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) throw new Error("Could not save your watchlist");
  return { watchlist: data };
});