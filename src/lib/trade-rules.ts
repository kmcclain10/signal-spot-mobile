import { z } from "zod";

/** Manual paper order ticket for the selected stock/ETF or its at-the-money option. */
export const tickerSymbol = z.string().trim().toUpperCase().regex(/^[A-Z][A-Z.]{0,9}$/, "Enter a valid ticker");
export const stockTicket = z.object({
  kind: z.literal("stock"),
  symbol: tickerSymbol,
  side: z.enum(["buy", "sell"]),
  qty: z.number().int().min(1).max(10000),
  type: z.enum(["market", "limit"]),
  limit_price: z.number().positive().max(100000).optional(),
}).refine(t => t.type === "market" || t.limit_price != null, { message: "Limit orders need a price", path: ["limit_price"] });

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

export function toBrokerOrder(t: z.infer<typeof stockTicket>, clientId: string) {
  return {
    symbol: t.symbol, qty: String(t.qty), side: t.side, type: t.type, time_in_force: "day", client_order_id: clientId,
    ...(t.type === "limit" ? { limit_price: Number(t.limit_price).toFixed(2) } : {}),
  };
}
