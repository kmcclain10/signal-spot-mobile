import { etParts, windowOf, type IndRow, type Signal, type StrategyConfig } from '@/lib/iwmWindowStrategy';

export const IWM_STOP_PCT = 20;
export const IWM_PARTIAL_TARGET_PCT = 35;
export const IWM_PROFIT_TARGET_PCT = 50;
export const IWM_TRAIL_GIVEBACK_PTS = 12;
/** Tiered trail: once the peak reaches +30%, tighten the giveback to 7 points. */
export const IWM_TRAIL_TIGHT_AT_PCT = 30;
export const IWM_TRAIL_TIGHT_GIVEBACK_PTS = 7;
/** Trailing profit activates at +15%; the floor never drops below break-even once active. */
export const IWM_TRAIL_ACTIVATE_PCT = 15;
/** Midday lull (ET minutes): no new entries 11:30 AM – 1:30 PM. */
export const IWM_LULL_START = 690, IWM_LULL_END = 810;
export const inMiddayLull = (t: string) => { const m = etParts(t).minutes; return m >= IWM_LULL_START && m < IWM_LULL_END; };
export function crossEntry(row: IndRow, seen: Set<string>, cfg: StrategyConfig, orb?: {high:number;low:number}|null): Signal[] {
  const window = windowOf(row.t,cfg);
  if (window === null || inMiddayLull(row.t)) return [];
  const side = row.bullCross ? 'CALL' : row.bearCross ? 'PUT' : null;
  if (!side) return [];
  const key = `cross|${row.t}|${side}`;
  if (seen.has(key)) return [];
  seen.add(key);
  return [{ kind:'entry',side,barTime:row.t,window,price:row.c,detail:`Confirmed ${cfg.timeframeMin}-minute 8/20 EMA cross` }];
}
export function profitAction(trade: Record<string,any>, bid: number) {
  const remaining = Number(trade.contracts)-Number(trade.exitFilledQty ?? 0);
  if (!(remaining>0) || !(trade.entryPremium>0) || !(bid>0)) return null;
  // Direct premium comparisons avoid boundary rounding at exactly -20%, +35%, +50%.
  if (bid <= trade.entryPremium*(1-IWM_STOP_PCT/100)) return {reason:'-20% option stop',qty:remaining,partial:false};
  // No partial sell: once +15% is reached, trail 12 points below the peak (floor at break-even) and ride to the 8/20 cross-back.
  const peak = Math.max(Number(trade.peakPremium) || 0, bid);
  const peakPct = (peak/trade.entryPremium-1)*100;
  const giveback = peakPct >= IWM_TRAIL_TIGHT_AT_PCT-1e-9 ? IWM_TRAIL_TIGHT_GIVEBACK_PTS : IWM_TRAIL_GIVEBACK_PTS;
  if (peakPct >= IWM_TRAIL_ACTIVATE_PCT-1e-9 && bid <= trade.entryPremium*(1+Math.max(0,peakPct-giveback)/100)+1e-9) {
    return {reason:`Trailing profit lock (peak +${Math.round(peakPct)}%)`,qty:remaining,partial:false};
  }
  return null;
}
export function profitableReversal(trade: Record<string,any>, row: IndRow, bid: number): boolean {
  return Date.parse(row.t)>=Date.parse(trade.entryCloseTime) && bid>trade.entryPremium && (trade.side==='CALL' ? row.red : row.green);
}
export function nearestAtmContracts<T extends {strike_price: string | number}>(contracts:T[],spot:number):T[] {
  const distances=contracts.map(c=>Math.abs(Number(c.strike_price)-spot)).filter(Number.isFinite);
  const nearest=Math.min(...distances);
  return contracts.filter(c=>Math.abs(Number(c.strike_price)-spot)<=nearest+1e-8);
}/** Trend failure: a closed one-minute bar on the wrong side of the 8 EMA, after the entry bar. */
export function emaCloseBreak(trade: Record<string,any>, row: IndRow): boolean {
  if (!(Date.parse(row.t)>=Date.parse(trade.entryCloseTime)) || !Number.isFinite(row.emaFast)) return false;
  return trade.side==='CALL' ? row.c<row.emaFast : row.c>row.emaFast;
}
export const IWM_SAVINGS_SYMBOL = 'WMT';
export const IWM_SAVINGS_SHARE = 0.5;
/** Half of a positive day's net profit, rounded down to cents; Alpaca fractional orders need at least $1. */
export function savingsAmount(pnlToday: number): number {
  if (!(pnlToday>0)) return 0;
  const amt = Math.floor(pnlToday*IWM_SAVINGS_SHARE*100)/100;
  return amt>=1 ? amt : 0;
}
/** Real-money habit: in profit with a 1–2 cent spread, take the bid now (market) instead of waiting for a tick. */
export const IWM_TIGHT_SPREAD = 0.02;
export function takeTheBid(entryPremium: number, bid?: number, ask?: number): boolean {
  return Number(bid)>Number(entryPremium) && Number(ask)>=Number(bid) && Number(ask)-Number(bid)<=IWM_TIGHT_SPREAD+1e-9;
}

/** Trend exit: the 8 EMA crosses back over the 20 EMA against the trade, after the entry bar closed. */
export function emaCrossBack(trade: Record<string,any>, row: IndRow): boolean {
  if (!(Date.parse(row.t)>=Date.parse(trade.entryCloseTime)) || !Number.isFinite(row.emaFast) || !Number.isFinite(row.emaSlow)) return false;
  return trade.side==='CALL' ? row.emaFast<row.emaSlow : row.emaFast>row.emaSlow;
}
