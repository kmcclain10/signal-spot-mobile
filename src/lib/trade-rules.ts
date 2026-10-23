import { z } from "zod";

/** Manual paper order ticket for the selected stock/ETF or its at-the-money option. */
export const tickerSymbol = z.string().trim().toUpperCase().regex(/^[A-Z][A-Z.]{0,9}$/, "Enter a valid ticker");
const price = z.number().positive().max(100000);
/**
 * Expanded stock ticket. Mirrors Alpaca's order rules so a bad ticket is rejected before it reaches the broker:
 * dollar (fractional) orders are market + day only; extended hours are limit + day only.
 */
export const stockTicket = z.object({
  kind: z.literal("stock"),
  symbol: tickerSymbol,
  side: z.enum(["buy", "sell"]),
  qty: z.number().int().min(1).max(10000).optional(),
  notional: z.number().min(1).max(1000000).optional(),
  type: z.enum(["market", "limit", "stop", "stop_limit"]),
  limit_price: price.optional(),
  stop_price: price.optional(),
  time_in_force: z.enum(["day", "gtc"]).default("day"),
  extended_hours: z.boolean().default(false),
}).superRefine((t, ctx) => {
  const err = (message: string, path: string) => ctx.addIssue({ code: "custom", message, path: [path] });
  if ((t.qty == null) === (t.notional == null)) err("Enter either shares or a dollar amount", "qty");
  if ((t.type === "limit" || t.type === "stop_limit") && t.limit_price == null) err("Limit orders need a limit price", "limit_price");
  if ((t.type === "stop" || t.type === "stop_limit") && t.stop_price == null) err("Stop orders need a stop price", "stop_price");
  if (t.notional != null && (t.type !== "market" || t.time_in_force !== "day")) err("Dollar amounts work only with market day orders", "notional");
  if (t.extended_hours && (t.type !== "limit" || t.time_in_force !== "day")) err("Extended hours need a limit day order", "extended_hours");
  if (t.type === "stop_limit" && t.limit_price != null && t.stop_price != null &&
      (t.side === "buy" ? t.limit_price < t.stop_price : t.limit_price > t.stop_price))
    err(t.side === "buy" ? "Buy stop-limit: limit must be at or above the stop" : "Sell stop-limit: limit must be at or below the stop", "limit_price");
});
export type StockTicket = z.infer<typeof stockTicket>;

export const optionTicket = z.object({
  kind: z.literal("option"),
  symbol: tickerSymbol,
  side: z.enum(["CALL", "PUT"]),
  contracts: z.number().int().min(1).max(50),
});

export const tradeTicket = z.union([stockTicket, optionTicket]);
export type TradeTicket = z.infer<typeof tradeTicket>;

/** IWM keeps the bot's original strike range; other underlyings allow wider strike spacing. */
export function optionContractParams(symbol: string, side: "CALL" | "PUT", spot: number, today: string, end: string) {
  const range = symbol === "IWM" ? 3 : Math.max(3, spot * 0.03);
  return { underlying_symbols: symbol, status: "active", type: side === "CALL" ? "call" : "put",
    expiration_date_gte: today, expiration_date_lte: end,
    strike_price_gte: String(spot - range), strike_price_lte: String(spot + range), limit: "1000" };
}

/** Estimated cost of a ticket in dollars; options are 100 shares per contract. */
export function ticketCost(price: number, qty: number, option: boolean) {
  return Math.round(price * qty * (option ? 100 : 1) * 100) / 100;
}

export function toBrokerOrder(t: StockTicket, clientId: string) {
  return {
    symbol: t.symbol, side: t.side, type: t.type, time_in_force: t.time_in_force, client_order_id: clientId,
    ...(t.notional != null ? { notional: t.notional.toFixed(2) } : { qty: String(t.qty) }),
    ...(t.limit_price != null && (t.type === "limit" || t.type === "stop_limit") ? { limit_price: t.limit_price.toFixed(2) } : {}),
    ...(t.stop_price != null && (t.type === "stop" || t.type === "stop_limit") ? { stop_price: t.stop_price.toFixed(2) } : {}),
    ...(t.extended_hours ? { extended_hours: true } : {}),
  };
}

/** Plain-language order status and whether the order can still change. */
export function orderStatus(status: string, filled: number, qty: number) {
  const s = String(status);
  if (s === "filled") return { label: "Filled", tone: "gain", done: true };
  if (s === "partially_filled") return { label: `Partly filled ${filled}/${qty}`, tone: "warning", done: false };
  if (["canceled", "expired", "replaced", "done_for_day"].includes(s)) return { label: s === "done_for_day" ? "Done for day" : s[0].toUpperCase() + s.slice(1), tone: "muted", done: true };
  if (["rejected", "suspended", "stopped"].includes(s)) return { label: s[0].toUpperCase() + s.slice(1), tone: "loss", done: true };
  if (s === "pending_cancel") return { label: "Canceling", tone: "warning", done: false };
  return { label: "Working", tone: "warning", done: false };
}

/** Underlying root of an OCC option symbol, e.g. AAPL261120C00200000 → AAPL. */
export const occRoot = (contract: string) => contract.replace(/\d{6}[CP]\d{8}$/, "");
export const occContract = z.string().trim().toUpperCase().regex(/^[A-Z]{1,6}\d{6}[CP]\d{8}$/, "Choose a contract from the chain");

/**
 * Option chain ticket. Limit orders only, no naked short selling (sell only to close),
 * and the contract must belong to the selected underlying.
 */
export const chainTicket = z.object({
  symbol: tickerSymbol,
  contract: occContract,
  intent: z.enum(["buy_to_open", "sell_to_close"]),
  contracts: z.number().int().min(1).max(50),
  limit_price: z.number().min(0.01).max(1000),
}).refine(t => occRoot(t.contract) === t.symbol, { message: "That contract belongs to a different stock", path: ["contract"] });
export type ChainTicket = z.infer<typeof chainTicket>;

/** Strikes shown around the stock price: ±10% (at least $5). */
export const chainStrikeRange = (spot: number) => Math.max(5, spot * 0.1);

/** Fat-finger guard against the live quote: buys at most 25% over the ask, sells at least 75% of the bid. */
export function optionLimitProblem(intent: ChainTicket["intent"], limit: number, bid: number, ask: number) {
  if (intent === "buy_to_open") {
    if (!(ask > 0)) return "No live ask price for this contract right now";
    if (limit > Math.round(ask * 1.25 * 100) / 100 + 0.05) return `Limit is far above the ask (${ask.toFixed(2)})`;
  } else if (bid > 0 && limit < Math.round(bid * 0.75 * 100) / 100 - 0.05) return `Limit is far below the bid (${bid.toFixed(2)})`;
  return null;
}

/** Sell-to-close may not exceed the contracts you hold. */
export function closeQtyProblem(held: number, qty: number) {
  if (held <= 0) return "You don't hold this contract";
  return qty > held ? `You hold only ${held} contract${held === 1 ? "" : "s"}` : null;
}
