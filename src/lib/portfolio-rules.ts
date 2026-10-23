import { z } from "zod";

export const portfolioRange = z.enum(["1D", "1W", "1M", "3M", "YTD", "1Y", "ALL"]);
export type PortfolioRange = z.infer<typeof portfolioRange>;
export const watchlistInput = z.array(z.string().trim().toUpperCase().regex(/^[A-Z][A-Z.]{0,9}$/)).max(50).refine(v => new Set(v).size === v.length, "Symbol is already on your watchlist");
export function historyParams(range: PortfolioRange, now: Date, created?: string) {
  const params: Record<string, string> = { timeframe: range === "1D" ? "5Min" : range === "1W" ? "15Min" : "1D", intraday_reporting: "market_hours", pnl_reset: "no_reset" };
  if (range === "YTD") { params.start = `${now.getUTCFullYear()}-01-01T00:00:00Z`; params.end = now.toISOString(); }
  else if (range === "ALL") { params.start = created && Number.isFinite(Date.parse(created)) ? new Date(created).toISOString() : "2000-01-01T00:00:00Z"; params.end = now.toISOString(); }
  else params.period = range;
  return params;
}
export type EquityPoint = { timestamp: number; equity: number; pnl: number | null; pct: number | null };
export function equityPoints(raw: { timestamp?: number[]; equity?: (number | null)[]; profit_loss?: (number | null)[]; profit_loss_pct?: (number | null)[] }): EquityPoint[] {
  return (raw.timestamp ?? []).flatMap((timestamp, i) => {
    const equity = raw.equity?.[i];
    if (!Number.isFinite(timestamp) || typeof equity !== "number" || !Number.isFinite(equity)) return [];
    return [{ timestamp, equity, pnl: raw.profit_loss?.[i] ?? null, pct: raw.profit_loss_pct?.[i] ?? null }];
  });
}
export const portfolioRefreshInterval = (visible: boolean) => visible ? 5000 : false;
export function moveWatchSymbol(values: string[], index: number, direction: -1 | 1) {
  const next = [...values], target = index + direction;
  if (index < 0 || target < 0 || index >= next.length || target >= next.length) return next;
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}