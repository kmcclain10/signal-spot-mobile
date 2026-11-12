import { z } from "zod";
import { occContract, occRoot, tickerSymbol } from "@/lib/trade-rules";

/** Industry-standard multi-leg presets (defined-risk only; no naked short legs). */
export const STRATEGIES = [
  { id: "bull_call", label: "Bull call spread", group: "Vertical", view: "Bullish", note: "Buy a call, sell a higher call. Pay a debit." },
  { id: "bear_put", label: "Bear put spread", group: "Vertical", view: "Bearish", note: "Buy a put, sell a lower put. Pay a debit." },
  { id: "bull_put", label: "Bull put spread (credit)", group: "Vertical", view: "Bullish", note: "Sell a put, buy a lower put. Collect a credit." },
  { id: "bear_call", label: "Bear call spread (credit)", group: "Vertical", view: "Bearish", note: "Sell a call, buy a higher call. Collect a credit." },
  { id: "long_straddle", label: "Long straddle", group: "Volatility", view: "Big move", note: "Buy a call and a put at the same strike." },
  { id: "long_strangle", label: "Long strangle", group: "Volatility", view: "Big move", note: "Buy an out-of-the-money call and put." },
  { id: "iron_condor", label: "Iron condor", group: "Income", view: "Range-bound", note: "Sell a put spread and a call spread. Collect a credit." },
  { id: "iron_butterfly", label: "Iron butterfly", group: "Income", view: "Pinned", note: "Sell the at-the-money call and put, buy wings." },
  { id: "call_butterfly", label: "Call butterfly", group: "Butterfly", view: "Pinned", note: "Buy 1 lower call, sell 2 middle, buy 1 higher." },
  { id: "put_butterfly", label: "Put butterfly", group: "Butterfly", view: "Pinned", note: "Buy 1 higher put, sell 2 middle, buy 1 lower." },
  { id: "call_calendar", label: "Call calendar", group: "Time", view: "Neutral", note: "Sell a near call, buy a later call, same strike." },
  { id: "put_calendar", label: "Put calendar", group: "Time", view: "Neutral", note: "Sell a near put, buy a later put, same strike." },
  { id: "call_diagonal", label: "Call diagonal", group: "Time", view: "Mildly bullish", note: "Buy a later call, sell a nearer higher call." },
  { id: "put_diagonal", label: "Put diagonal", group: "Time", view: "Mildly bearish", note: "Buy a later put, sell a nearer lower put." },
] as const;
export type StrategyId = typeof STRATEGIES[number]["id"];
export const needsFarExpiration = (id: StrategyId) => STRATEGIES.find(s => s.id === id)!.group === "Time";

export type Quote = { contract: string; strike: number; bid: number; ask: number };
export type Chain = { calls: Quote[]; puts: Quote[] };
export type Leg = Quote & { type: "CALL" | "PUT"; expiration: string; side: "buy" | "sell"; ratio: number };

/**
 * Builds legs from a center strike index and a width in strike steps.
 * Returns null when the chain doesn't have the strikes needed.
 */
export function buildLegs(id: StrategyId, near: Chain, nearExp: string, center: number, width: number, far?: Chain, farExp?: string): Leg[] | null {
  const strikes = near.calls.map(c => c.strike).filter(s => near.puts.some(p => p.strike === s)).sort((a, b) => a - b);
  const w = Math.max(1, Math.floor(width));
  const at = (k: number) => strikes[k];
  const find = (ch: Chain | undefined, t: "CALL" | "PUT", strike: number | undefined) => strike == null || !ch ? undefined : (t === "CALL" ? ch.calls : ch.puts).find(q => q.strike === strike);
  const leg = (t: "CALL" | "PUT", side: "buy" | "sell", k: number, ratio = 1, useFar = false): Leg | null => {
    const q = find(useFar ? far : near, t, at(k)); if (!q) return null;
    return { ...q, type: t, side, ratio, expiration: useFar ? farExp ?? "" : nearExp };
  };
  const i = center, C = "CALL" as const, P = "PUT" as const;
  const plan: (Leg | null)[] = (() => { switch (id) {
    case "bull_call": return [leg(C, "buy", i), leg(C, "sell", i + w)];
    case "bear_call": return [leg(C, "sell", i), leg(C, "buy", i + w)];
    case "bear_put": return [leg(P, "buy", i), leg(P, "sell", i - w)];
    case "bull_put": return [leg(P, "sell", i), leg(P, "buy", i - w)];
    case "long_straddle": return [leg(C, "buy", i), leg(P, "buy", i)];
    case "long_strangle": return [leg(C, "buy", i + w), leg(P, "buy", i - w)];
    case "iron_condor": return [leg(P, "buy", i - 2 * w), leg(P, "sell", i - w), leg(C, "sell", i + w), leg(C, "buy", i + 2 * w)];
    case "iron_butterfly": return [leg(P, "buy", i - w), leg(P, "sell", i), leg(C, "sell", i), leg(C, "buy", i + w)];
    case "call_butterfly": return [leg(C, "buy", i - w), leg(C, "sell", i, 2), leg(C, "buy", i + w)];
    case "put_butterfly": return [leg(P, "buy", i + w), leg(P, "sell", i, 2), leg(P, "buy", i - w)];
    case "call_calendar": return [leg(C, "sell", i), leg(C, "buy", i, 1, true)];
    case "put_calendar": return [leg(P, "sell", i), leg(P, "buy", i, 1, true)];
    case "call_diagonal": return [leg(C, "sell", i + w), leg(C, "buy", i, 1, true)];
    case "put_diagonal": return [leg(P, "sell", i - w), leg(P, "buy", i, 1, true)];
  } })();
  if (plan.some(l => !l)) return null;
  const legs = plan as Leg[];
  return new Set(legs.map(l => l.contract)).size === legs.length ? legs : null;
}

/** Common strikes (calls and puts) in the near chain, for the center-strike picker. */
export const chainStrikes = (near: Chain) => near.calls.map(c => c.strike).filter(s => near.puts.some(p => p.strike === s)).sort((a, b) => a - b);

/** Net price per strategy at mid (+ debit to pay, − credit to receive). */
export const netMid = (legs: Leg[]) => Math.round(legs.reduce((a, l) => a + (l.side === "buy" ? 1 : -1) * l.ratio * ((l.bid + l.ask) / 2), 0) * 100) / 100;
/** Worst-case "natural" price: pay asks, receive bids. */
export const netNatural = (legs: Leg[]) => Math.round(legs.reduce((a, l) => a + (l.side === "buy" ? l.ask : -l.bid) * l.ratio, 0) * 100) / 100;

/**
 * Expiration payoff for same-expiration strategies, per 1 strategy (×100).
 * Calendars/diagonals return null: their value depends on the later option's remaining time.
 */
export function payoff(legs: Leg[], net: number) {
  if (new Set(legs.map(l => l.expiration)).size > 1) return null;
  const value = (S: number) => legs.reduce((a, l) => a + (l.side === "buy" ? 1 : -1) * l.ratio * Math.max(0, l.type === "CALL" ? S - l.strike : l.strike - S), 0) - net;
  const ks = [...new Set(legs.map(l => l.strike))].sort((a, b) => a - b);
  const pts = [0, ...ks, ks[ks.length - 1] * 2];
  const vals = pts.map(value);
  const upSlope = legs.reduce((a, l) => a + (l.type === "CALL" ? (l.side === "buy" ? 1 : -1) * l.ratio : 0), 0);
  const breakevens: number[] = [];
  for (let k = 1; k < pts.length; k++) {
    const [a, b] = [vals[k - 1], vals[k]];
    if ((a < 0 && b >= 0) || (a >= 0 && b < 0)) breakevens.push(Math.round((pts[k - 1] + (pts[k] - pts[k - 1]) * (-a / (b - a))) * 100) / 100);
  }
  const r = (v: number) => Math.round(v * 100);
  return { maxProfit: upSlope > 0 ? Infinity : r(Math.max(...vals)), maxLoss: upSlope < 0 ? Infinity : r(-Math.min(...vals)), breakevens };
}

/** Generic multi-leg order (2–4 legs) sent as one Alpaca mleg limit order. */
export const strategyTicket = z.object({
  symbol: tickerSymbol,
  action: z.enum(["open", "close"]),
  contracts: z.number().int().min(1).max(50),
  /** Positive = net debit paid, negative = net credit received (per strategy, in the opening direction for open; actual for close). */
  limit_price: z.number().min(-1000).max(1000).refine(v => Math.abs(v) >= 0.01, "Enter a net price"),
  legs: z.array(z.object({ contract: occContract, side: z.enum(["buy", "sell"]), ratio: z.number().int().min(1).max(3) })).min(2).max(4),
}).refine(t => new Set(t.legs.map(l => l.contract)).size === t.legs.length, { message: "Each leg needs a different contract", path: ["legs"] })
  .refine(t => t.legs.every(l => occRoot(l.contract) === t.symbol), { message: "All legs must be on this stock", path: ["legs"] });
export type StrategyTicket = z.infer<typeof strategyTicket>;

/** Alpaca mleg legs. Opening uses the preset sides; closing reverses each leg. */
export function mlegLegs(t: StrategyTicket) {
  return t.legs.map(l => {
    const buy = t.action === "open" ? l.side === "buy" : l.side === "sell";
    return { symbol: l.contract, ratio_qty: String(l.ratio), side: buy ? "buy" : "sell",
      position_intent: t.action === "open" ? (buy ? "buy_to_open" : "sell_to_open") : (buy ? "buy_to_close" : "sell_to_close") };
  });
}

/** Closing needs the opened position on every leg: long legs held, short legs owed. */
export function closeLegsProblem(t: StrategyTicket, held: (c: string) => number) {
  for (const l of t.legs) {
    const need = t.contracts * l.ratio, h = held(l.contract);
    if (l.side === "buy" && h < need) return "You don't hold enough of a long leg to close";
    if (l.side === "sell" && h > -need) return "You don't owe enough of a short leg to close";
  }
  return null;
}
