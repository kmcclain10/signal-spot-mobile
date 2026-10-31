import { etParts, windowOf, type Bar, type StrategyConfig } from "@/lib/iwmWindowStrategy";

export const IWM_PAPER_URL = "https://paper-api.alpaca.markets";
export function requireIwmPaper(connection: { provider: string; environment: string; config?: Record<string, any> }) {
  if (connection.provider !== "alpaca" || connection.environment !== "paper" ||
      (connection.config?.base_url && connection.config.base_url.replace(/\/$/, "") !== IWM_PAPER_URL)) {
    throw new Error("IWM automation requires an Alpaca paper connection; live orders are prohibited.");
  }
  return IWM_PAPER_URL;
}
export function closedRegularBars(bars: Bar[], now: Date, cfg: StrategyConfig) {
  return [...new Map(bars.map(b => [b.t, b])).values()]
    .filter(b => {
      const p = etParts(b.t);
      return p.minutes >= 570 && p.minutes < 960 && new Date(b.t).getTime() + cfg.timeframeMin * 60000 <= now.getTime();
    }).sort((a,b) => Date.parse(a.t) - Date.parse(b.t)).slice(-600);
}
/** Quotes older than this never trigger entries, stops or floors. */
export const QUOTE_MAX_AGE_MS = 15000;
export function freshQuote(quote: any, now: Date) {
  return Number(quote?.bp) > 0 && Number(quote?.ap) > 0 && Number(quote?.ap) >= Number(quote?.bp) &&
    Number.isFinite(Date.parse(quote?.t)) && Math.abs(now.getTime() - Date.parse(quote.t)) <= QUOTE_MAX_AGE_MS;
}
/** Last entry minute (ET): 15:00, or 60 minutes before an early close. */
export const sessionEndMinutes = (closeMinutes: number) => Math.min(900, closeMinutes - 60);
/** New entries are blocked by the kill switch, an unresolved broker mismatch, or the daily loss limit. */
export function entryBlock(settings: Record<string, any>, state: Record<string, any>) {
  if (settings.kill_switch) return "kill switch";
  if (state.needs_review) return "needs review";
  if (Number(state.pnl_today ?? 0) <= -Math.abs(Number(settings.max_daily_loss ?? 100))) return "daily loss limit";
  return null;
}
/** Compare the bot's records with real broker positions. Alpaca is the source of truth. */
export function positionMismatch(state: Record<string, any>, positions: { symbol: string; asset_class?: string }[], underlying = "IWM") {
  const symbols = new Set(positions.filter(p => p.asset_class === "us_option" && p.symbol.startsWith(underlying)).map(p => p.symbol));
  const mine = state.open_trade?.optionSymbol;
  if (mine && !symbols.has(mine) && !state.pending_order) return { kind: "missing" as const, symbol: mine };
  const orphan = [...symbols].find(s => s !== mine && s !== state.pending_order?.contract?.symbol);
  if (orphan) return { kind: "orphan" as const, symbol: orphan };
  return null;
}
export const terminalOrder = (status: string) => ["filled", "canceled", "expired", "rejected"].includes(status);
/** Latest close-out: 3:40 PM ET (before broker 0DTE auto-liquidation), or 20 minutes before an early close. */
export const IWM_LATEST_EXIT_MIN = 940;
export const iwmForceExitAt = (value: string, closeMinutes: number) => Math.min(forceExitMinutes(value || "15:40"), IWM_LATEST_EXIT_MIN, closeMinutes - 20);
/** Opening range: high/low of today's 9:30–9:59 ET regular bars. */
export function openingRange(bars: Bar[], date: string) {
  const r = bars.filter(b => { const p = etParts(b.t); return p.date === date && p.minutes >= 570 && p.minutes < 600; });
  if (!r.length) return null;
  return { high: Math.max(...r.map(b => b.h)), low: Math.min(...r.map(b => b.l)) };
}
export const forceExitMinutes = (value: string) => { const [h,m] = value.split(":").map(Number); return h*60+m; };
/** Start liquidation in the final minute, leaving one scheduled interval for fills. */
export function iwmWindowExitAt(barTime: string, cfg: StrategyConfig, entryWindow?: number): number | null {
  const stamp = Date.parse(barTime);
  if (!Number.isFinite(stamp)) return null;
  const window = entryWindow ?? windowOf(barTime, cfg);
  if (window == null) return null;
  const endMinute = forceExitMinutes(cfg.sessionStart) + window * cfg.windowMin;
  const minuteStart = Math.floor(stamp / 60000) * 60000;
  return minuteStart + (endMinute - etParts(barTime).minutes - 1) * 60000;
}
export function iwmScheduleTime(now: Date) {
  const wd = new Intl.DateTimeFormat("en-US",{timeZone:"America/New_York",weekday:"short"}).format(now);
  const {minutes} = etParts(now.toISOString());
  return wd !== "Sat" && wd !== "Sun" && minutes >= 570 && minutes <= 990;
}