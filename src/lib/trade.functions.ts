import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { tradeTicket, toBrokerOrder, chainTicket, chainStrikeRange, optionLimitProblem, closeQtyProblem } from "@/lib/trade-rules";
import { assertNoPulseOwnership, isBotOrder } from "@/lib/bot-ownership";

type Rec = Record<string, any>;
async function broker(userId: string) {
  const { iwmAlpaca } = await import("@/lib/server/iwm-alpaca.server");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return { api: await iwmAlpaca(supabaseAdmin, userId), db: supabaseAdmin };
}
const pick = (o: Rec) => ({
  id: o.id, symbol: o.symbol, side: o.side, qty: Number(o.qty ?? 0), filled_qty: Number(o.filled_qty ?? 0), type: o.type,
  limit_price: o.limit_price ? Number(o.limit_price) : null, filled_avg_price: o.filled_avg_price ? Number(o.filled_avg_price) : null,
  status: o.status, submitted_at: o.submitted_at, asset_class: o.asset_class, bot: isBotOrder(o.client_order_id),
  stop_price: o.stop_price ? Number(o.stop_price) : null, notional: o.notional ? Number(o.notional) : null,
  time_in_force: o.time_in_force, extended_hours: !!o.extended_hours, filled_at: o.filled_at ?? null,
  canceled_at: o.canceled_at ?? null, expired_at: o.expired_at ?? null, failed_at: o.failed_at ?? null,
});

/** Paper account, positions and orders for the Trade desk. Read-only. */
export const getTradeDesk = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { api } = await broker(context.userId);
    const [account, positions, open, recent, clock] = await Promise.all([
      api.call("/v2/account"), api.call("/v2/positions"),
      api.call("/v2/orders?status=open&limit=50&nested=false"), api.call("/v2/orders?status=closed&limit=20"), api.clock(),
    ]);
    const state = await context.supabase.from("iwm_strategy_state").select("open_trade").eq("user_id", context.userId).maybeSingle();
    const botSymbol = (state.data?.open_trade as Rec | null)?.optionSymbol ?? null;
    const pulse=await context.supabase.from("pulse_bot_states").select("state").eq("user_id",context.userId);
    if(pulse.error) throw new Error("Could not read bot ownership");
    const pulseSymbols=new Set((pulse.data??[]).map(r=>(r.state as Rec)?.position?.symbol));
    return {
      account: { equity: Number(account.equity), cash: Number(account.cash), buying_power: Number(account.buying_power),
        options_buying_power: Number(account.options_buying_power ?? account.buying_power), options_level: Number(account.options_trading_level ?? 0),
        day_pnl: Number(account.equity) - Number(account.last_equity) },
      clock: { is_open: !!clock.is_open, next_open: clock.next_open, next_close: clock.next_close },
      positions: (positions ?? []).map((p: Rec) => ({ symbol: p.symbol, qty: Number(p.qty), side: p.side, asset_class: p.asset_class,
        avg_entry: Number(p.avg_entry_price), current: Number(p.current_price), market_value: Number(p.market_value),
        pnl: Number(p.unrealized_pl), pnl_pct: Number(p.unrealized_plpc) * 100, bot: p.symbol === botSymbol || pulseSymbols.has(p.symbol) })),
      open: (open ?? []).map(pick), recent: (recent ?? []).map(pick),
    };
  });

/** Live quote for the selected underlying and its nearest-expiry at-the-money option. */
export const getTicketQuote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ symbol: z.string().regex(/^[A-Z][A-Z.]{0,9}$/), option: z.enum(["CALL", "PUT"]).optional() }).parse(i))
  .handler(async ({ data, context }) => {
    const { api } = await broker(context.userId);
    const q = await api.call(`/v2/stocks/${data.symbol}/quotes/latest?feed=iex`, "GET", undefined, true).catch(() => null);
    const t = await api.call(`/v2/stocks/${data.symbol}/trades/latest?feed=iex`, "GET", undefined, true).catch(() => null);
    const last = Number(t?.trade?.p ?? 0), bid = Number(q?.quote?.bp ?? 0), ask = Number(q?.quote?.ap ?? 0);
    if (!data.option) return { symbol: data.symbol, last, bid, ask, contract: null };
    const clock = await api.clock(); const now = new Date(clock.timestamp);
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(now);
    const contract = last > 0 ? await api.chooseContract(data.option, last, today, "indicative", now, data.symbol) : null;
    return { symbol: data.symbol, last, bid, ask, contract };
  });

/** Places one manual paper order. The broker client is hard-locked to paper-api.alpaca.markets. */
export const placeManualTrade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => tradeTicket.parse(i))
  .handler(async ({ data, context }) => {
    const { api } = await broker(context.userId);
    const clientId = `manual-${crypto.randomUUID()}`;
    await assertNoPulseOwnership(context.supabase,context.userId,data.symbol);
    if (data.kind === "stock") {
      if (data.notional != null) {
        const asset = await api.call(`/v2/assets/${data.symbol}`);
        if (!asset?.fractionable) throw new Error(`${data.symbol} can't be bought by dollar amount; use whole shares`);
      }
      return pick(await api.submit(toBrokerOrder(data, clientId)));
    }
    const clock = await api.clock();
    if (!clock.is_open) throw new Error("Options can only be traded while the market is open");
    const now = new Date(clock.timestamp);
    const t = await api.call(`/v2/stocks/${data.symbol}/trades/latest?feed=iex`, "GET", undefined, true);
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(now);
    const spot = Number(t?.trade?.p);
    if (!Number.isFinite(spot) || spot <= 0) throw new Error(`No fresh ${data.symbol} stock price is available right now`);
    const contract = await api.chooseContract(data.side, spot, today, "indicative", now, data.symbol);
    if (!contract) throw new Error(`No ${data.symbol} option with a fresh quote is available right now`);
    return pick(await api.submit({ symbol: contract.symbol, qty: String(data.contracts), side: "buy", type: "limit",
      limit_price: contract.ask.toFixed(2), time_in_force: "day", position_intent: "buy_to_open", client_order_id: clientId }));
  });

export const cancelPaperOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { api } = await broker(context.userId);
    const order = await api.order(data.id);
    if (isBotOrder(order.client_order_id)) throw new Error("This order belongs to a bot; stop it from Bots instead");
    return pick(await api.cancel(data.id));
  });

/**
 * Closes a position. A bot-managed IWM option is never sold behind the bot's back:
 * we take the bot's run lock and flag the exit so the bot sells it and records the journal.
 */
export const closePaperPosition = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ symbol: z.string().regex(/^[A-Z0-9.]{1,25}$/) }).parse(i))
  .handler(async ({ data, context }) => {
    const { api, db } = await broker(context.userId);
    await assertNoPulseOwnership(context.supabase,context.userId,data.symbol);
    const st = await context.supabase.from("iwm_strategy_state").select("open_trade").eq("user_id", context.userId).maybeSingle();
    if ((st.data?.open_trade as Rec | null)?.optionSymbol !== data.symbol) {
      await api.call(`/v2/positions/${encodeURIComponent(data.symbol)}`, "DELETE");
      return { closed: true, viaBot: false };
    }
    const token = crypto.randomUUID();
    const { data: locks, error } = await db.rpc("iwm_acquire_lock", { p_user_id: context.userId, p_token: token });
    if (error) throw new Error("Could not reach the IWM bot");
    const state = locks?.[0] as Rec | undefined;
    if (!state) throw new Error("The IWM bot is mid-check; try again in a few seconds");
    try {
      if (!state.open_trade) return { closed: true, viaBot: true };
      state.open_trade.exitRequested = "Manual close from Trade desk";
      const saved = await db.rpc("iwm_save_state", { p_user_id: context.userId, p_token: token, p_state: state, p_events: {} });
      if (saved.error) throw new Error("Could not hand the close to the IWM bot");
    } finally {
      await db.from("iwm_strategy_state").update({ lock_until: null, lock_token: null }).eq("user_id", context.userId).eq("lock_token", token);
    }
    return { closed: false, viaBot: true };
  });

/** Read-only status of one paper order, for the order status sheet. */
export const getPaperOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { api } = await broker(context.userId);
    return pick(await api.order(data.id));
  });

const nyToday = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(d);

/** Option chain for the selected underlying: expirations in the next 60 days and strikes near the price, with live quotes. */
export const getOptionChain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ symbol: z.string().regex(/^[A-Z][A-Z.]{0,9}$/), type: z.enum(["call", "put"]), expiration: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }).parse(i))
  .handler(async ({ data, context }) => {
    const { api } = await broker(context.userId);
    const [clock, t, positions] = await Promise.all([api.clock(), api.call(`/v2/stocks/${data.symbol}/trades/latest?feed=iex`, "GET", undefined, true).catch(() => null), api.call("/v2/positions")]);
    const spot = Number(t?.trade?.p ?? 0);
    const today = nyToday(new Date(clock.timestamp));
    const base = { symbol: data.symbol, spot, today, market_open: !!clock.is_open };
    if (!(spot > 0)) return { ...base, expirations: [] as string[], expiration: null, rows: [], error: `No ${data.symbol} stock price available right now` };
    const range = chainStrikeRange(spot);
    const end = new Date(Date.parse(`${today}T12:00:00Z`) + 60 * 86400000).toISOString().slice(0, 10);
    const contracts: Rec[] = []; let token: string | undefined;
    for (let n = 0; n < 5; n++) {
      const q = new URLSearchParams({ underlying_symbols: data.symbol, status: "active", type: data.type, expiration_date_gte: today, expiration_date_lte: end,
        strike_price_gte: String(spot - range), strike_price_lte: String(spot + range), limit: "1000", ...(token ? { page_token: token } : {}) });
      const r = await api.call(`/v2/options/contracts?${q}`);
      contracts.push(...(r?.option_contracts ?? []).filter((c: Rec) => c.tradable));
      token = r?.next_page_token; if (!token) break;
    }
    const expirations = [...new Set(contracts.map(c => String(c.expiration_date)))].sort();
    const expiration = data.expiration && expirations.includes(data.expiration) ? data.expiration : expirations[0] ?? null;
    const list = contracts.filter(c => c.expiration_date === expiration).sort((a, b) => +a.strike_price - +b.strike_price);
    const snaps: Rec = {};
    for (let i = 0; i < list.length; i += 100) {
      const r = await api.call(`/v1beta1/options/snapshots?${new URLSearchParams({ symbols: list.slice(i, i + 100).map(c => c.symbol).join(","), feed: "indicative", limit: "1000" })}`, "GET", undefined, true).catch(() => null);
      Object.assign(snaps, r?.snapshots ?? {});
    }
    const held = new Map<string, number>((positions ?? []).map((p: Rec) => [p.symbol, Number(p.qty)]));
    const rows = list.map(c => { const s = snaps[c.symbol] ?? {}; return {
      contract: String(c.symbol), strike: Number(c.strike_price), bid: Number(s.latestQuote?.bp ?? 0), ask: Number(s.latestQuote?.ap ?? 0),
      last: Number(s.latestTrade?.p ?? 0), quote_time: s.latestQuote?.t ?? null, iv: s.impliedVolatility != null ? Number(s.impliedVolatility) : null,
      delta: s.greeks?.delta != null ? Number(s.greeks.delta) : null, open_interest: c.open_interest != null ? Number(c.open_interest) : null, held: held.get(String(c.symbol)) ?? 0 }; });
    return { ...base, expirations, expiration, rows, error: null as string | null };
  });

/** Places a limit option order on a chosen contract. Paper only; sells only close contracts you hold; never touches the IWM bot's contract. */
export const placeChainOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => chainTicket.parse(i))
  .handler(async ({ data, context }) => {
    const { api } = await broker(context.userId);
    const [clock, account, positions] = await Promise.all([api.clock(), api.account(), api.call("/v2/positions")]);
    await assertNoPulseOwnership(context.supabase,context.userId,data.contract);
    if (!clock.is_open) throw new Error("Options can only be traded while the market is open");
    const st = await context.supabase.from("iwm_strategy_state").select("open_trade").eq("user_id", context.userId).maybeSingle();
    if ((st.data?.open_trade as Rec | null)?.optionSymbol === data.contract) throw new Error("The IWM bot holds this contract; use Close on the position so the bot sells it");
    const snap = await api.call(`/v1beta1/options/snapshots?${new URLSearchParams({ symbols: data.contract, feed: "indicative" })}`, "GET", undefined, true);
    const q = snap?.snapshots?.[data.contract]?.latestQuote;
    const problem = optionLimitProblem(data.intent, data.limit_price, Number(q?.bp ?? 0), Number(q?.ap ?? 0));
    if (problem) throw new Error(problem);
    if (data.intent === "sell_to_close") {
      const held = Number((positions ?? []).find((p: Rec) => p.symbol === data.contract)?.qty ?? 0);
      const p2 = closeQtyProblem(held, data.contracts); if (p2) throw new Error(p2);
    } else {
      if (Number(account.options_trading_level ?? 0) < 2) throw new Error("Your paper account needs options level 2 to buy options");
      const cost = data.limit_price * data.contracts * 100;
      if (cost > Number(account.options_buying_power ?? account.buying_power)) throw new Error("Not enough options buying power for this order");
    }
    return pick(await api.submit({ symbol: data.contract, qty: String(data.contracts), side: data.intent === "buy_to_open" ? "buy" : "sell", type: "limit",
      limit_price: data.limit_price.toFixed(2), time_in_force: "day", position_intent: data.intent, client_order_id: `manual-${crypto.randomUUID()}` }));
  });
