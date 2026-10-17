import { etParts, type Bar, type StrategyConfig } from "@/lib/iwmWindowStrategy";

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
export function freshQuote(quote: any, now: Date) {
  return Number(quote?.bp) > 0 && Number(quote?.ap) >= Number(quote?.bp) &&
    Number.isFinite(Date.parse(quote?.t)) && Math.abs(now.getTime() - Date.parse(quote.t)) <= 120000;
}
export const terminalOrder = (status: string) => ["filled", "canceled", "expired", "rejected"].includes(status);
export const forceExitMinutes = (value: string) => { const [h,m] = value.split(":").map(Number); return h*60+m; };
export function iwmScheduleTime(now: Date) {
  const wd = new Intl.DateTimeFormat("en-US",{timeZone:"America/New_York",weekday:"short"}).format(now);
  const {minutes} = etParts(now.toISOString());
  return wd !== "Sat" && wd !== "Sun" && minutes >= 570 && minutes <= 990;
}