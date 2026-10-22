import { z } from "zod";

/** Manual paper order ticket. Stocks/ETFs or a quick IWM at-the-money option. */
export const stockTicket = z.object({
  kind: z.literal("stock"),
  symbol: z.string().trim().toUpperCase().regex(/^[A-Z][A-Z.]{0,9}$/, "Enter a valid ticker"),
  side: z.enum(["buy", "sell"]),
  qty: z.number().int().min(1).max(10000),
  type: z.enum(["market", "limit"]),
  limit_price: z.number().positive().max(100000).optional(),
}).refine(t => t.type === "market" || t.limit_price != null, { message: "Limit orders need a price", path: ["limit_price"] });

export const optionTicket = z.object({
  kind: z.literal("iwm_option"),
  side: z.enum(["CALL", "PUT"]),
  contracts: z.number().int().min(1).max(50),
});

export const tradeTicket = z.union([stockTicket, optionTicket]);
export type TradeTicket = z.infer<typeof tradeTicket>;

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
