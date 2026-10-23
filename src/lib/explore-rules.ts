import { z } from "zod";
export const quoteSymbol = z.string().trim().toUpperCase().regex(/^[A-Z][A-Z.]{0,9}$/);
export const quoteRange = z.enum(["1D", "1W", "1M", "3M", "1Y", "5Y"]);
export const tradeSearch = z.object({ symbol: quoteSymbol.optional(), side: z.enum(["buy", "sell"]).optional(), option: z.enum(["CALL", "PUT"]).optional() });
export type Asset = { symbol: string; name: string; tradable: boolean; optionable: boolean; fractionable: boolean; shortable: boolean; exchange: string };
export function filterAssets(assets: Asset[], input: string) {
  const query = input.trim().toUpperCase();
  if (!query) return [];
  return assets.filter(a => a.tradable && (a.symbol.includes(query) || a.name.toUpperCase().includes(query))).sort((a,b) => Number(b.symbol === query) - Number(a.symbol === query) || Number(b.symbol.startsWith(query)) - Number(a.symbol.startsWith(query)) || a.symbol.localeCompare(b.symbol)).slice(0, 30);
}
export function rememberSymbol(recent: string[], symbol: string) { return [symbol, ...recent.filter(s => s !== symbol)].slice(0, 8); }
export function quoteBarParams(range: z.infer<typeof quoteRange>, now: Date) {
  const start = new Date(now);
  if (range === "1D") start.setUTCDate(start.getUTCDate() - 4);
  else if (range === "1W") start.setUTCDate(start.getUTCDate() - 7);
  else if (range === "1M") start.setUTCMonth(start.getUTCMonth() - 1);
  else if (range === "3M") start.setUTCMonth(start.getUTCMonth() - 3);
  else start.setUTCFullYear(start.getUTCFullYear() - (range === "5Y" ? 5 : 1));
  return { start: start.toISOString(), end: now.toISOString(), timeframe: range === "1D" ? "5Min" : range === "1W" ? "1Hour" : "1Day", feed: "iex", adjustment: "all", limit: "10000", sort: "asc" };
}
export const safeNewsUrl = (input: string) => { try { const url = new URL(input); return url.protocol === "https:" ? url.href : null; } catch { return null; } };