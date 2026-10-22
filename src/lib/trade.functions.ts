import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { tradeTicket, toBrokerOrder } from "@/lib/trade-rules";

type Rec = Record<string, any>;
async function broker(userId: string) {
  const { iwmAlpaca } = await import("@/lib/server/iwm-alpaca.server");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return { api: await iwmAlpaca(supabaseAdmin, userId), db: supabaseAdmin };
}
const pick = (o: Rec) => ({
  id: o.id, symbol: o.symbol, side: o.side, qty: Number(o.qty ?? 0), filled_qty: Number(o.filled_qty ?? 0), type: o.type,
  limit_price: o.limit_price ? Number(o.limit_price) : null, filled_avg_price: o.filled_avg_price ? Number(o.filled_avg_price) : null,
  status: o.status, submitted_at: o.submitted_at, asset_class: o.asset_class, bot: String(o.client_order_id ?? "").startsWith("iwm-"),
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
    const botSymbol = state.data?.open_trade?.optionSymbol ?? null;
    return {
      account: { equity: Number(account.equity), cash: Number(account.cash), buying_power: Number(account.buying_power),
        options_buying_power: Number(account.options_buying_power ?? account.buying_power), options_level: Number(account.options_trading_level ?? 0),
        day_pnl: Number(account.equity) - Number(account.last_equity) },
      clock: { is_open: !!clock.is_open, next_open: clock.next_open, next_close: clock.next_close },
      positions: (positions ?? []).map((p: Rec) => ({ symbol: p.symbol, qty: Number(p.qty), side: p.side, asset_class: p.asset_class,
        avg_entry: Number(p.avg_entry_price), current: Number(p.current_price), market_value: Number(p.market_value),
        pnl: Number(p.unrealized_pl), pnl_pct: Number(p.unrealized_plpc) * 100, bot: p.symbol === botSymbol })),
      open: (open ?? []).map(pick), recent: (recent ?? []).map(pick),
    };
  });

/** Live quote for a ticket preview. IWM options pick the nearest-expiry at-the-money contract like the bot does. */
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
    const contract = last > 0 ? await api.chooseContract(data.option, last, today, "indicative", now) : null;
    return { symbol: data.symbol, last, bid, ask, contract };
  });

/** Places one manual paper order. The broker client is hard-locked to paper-api.alpaca.markets. */
export const placeManualTrade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => tradeTicket.parse(i))
  .handler(async ({ data, context }) => {
    const { api } = await broker(context.userId);
    const clientId = `manual-${crypto.randomUUID()}`;
    if (data.kind === "stock") return pick(await api.submit(toBrokerOrder(data, clientId)));
    const clock = await api.clock();
    if (!clock.is_open) throw new Error("Options can only be traded while the market is open");
    const now = new Date(clock.timestamp);
    const t = await api.call(`/v2/stocks/IWM/trades/latest?feed=iex`, "GET", undefined, true);
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(now);
    const contract = await api.chooseContract(data.side, Number(t?.trade?.p), today, "indicative", now);
    if (!contract) throw new Error("No IWM option with a fresh quote is available right now");
    return pick(await api.submit({ symbol: contract.symbol, qty: String(data.contracts), side: "buy", type: "limit",
      limit_price: contract.ask.toFixed(2), time_in_force: "day", position_intent: "buy_to_open", client_order_id: clientId }));
  });

export const cancelPaperOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { api } = await broker(context.userId);
    const order = await api.order(data.id);
    if (String(order.client_order_id ?? "").startsWith("iwm-")) throw new Error("This order belongs to the IWM bot; it manages its own orders");
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
    const st = await context.supabase.from("iwm_strategy_state").select("open_trade").eq("user_id", context.userId).maybeSingle();
    if (st.data?.open_trade?.optionSymbol !== data.symbol) {
      await api.call(`/v2/positions/${encodeURIComponent(data.symbol)}`, "DELETE");
      return { closed: true, viaBot: false };
    }
    const token = crypto.randomUUID();
    const { data: locks, error } = await db.rpc("iwm_acquire_lock", { p_user_id: context.userId, p_token: token });
    if (error) throw new Error("Could not reach the IWM bot");
    const state = locks?.[0];
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
