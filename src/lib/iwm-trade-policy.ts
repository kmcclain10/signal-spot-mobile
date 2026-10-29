import { isFinalBar, windowOf, type IndRow, type Signal, type StrategyConfig } from '@/lib/iwmWindowStrategy';

export const IWM_STOP_PCT = 20;
export const IWM_PARTIAL_TARGET_PCT = 35;
export const IWM_PROFIT_TARGET_PCT = 50;
export function crossEntry(row: IndRow, seen: Set<string>, cfg: StrategyConfig): Signal[] {
  const window = windowOf(row.t,cfg);
  if (window === null || isFinalBar(row.t,cfg)) return [];
  const side = row.bullCross ? 'CALL' : row.bearCross ? 'PUT' : null;
  if (!side) return [];
  const key = `cross|${row.t}|${side}`;
  if (seen.has(key)) return [];
  seen.add(key);
  return [{ kind:'entry',side,barTime:row.t,window,price:row.c,detail:'Confirmed one-minute 8/20 EMA cross' }];
}
export function profitAction(trade: Record<string,any>, bid: number) {
  const remaining = Number(trade.contracts)-Number(trade.exitFilledQty ?? 0);
  if (!(remaining>0) || !(trade.entryPremium>0) || !(bid>0)) return null;
  // Direct premium comparisons avoid boundary rounding at exactly -20%, +35%, +50%.
  if (bid <= trade.entryPremium*(1-IWM_STOP_PCT/100)) return {reason:'-20% option stop',qty:remaining,partial:false};
  if (bid >= trade.entryPremium*(1+IWM_PROFIT_TARGET_PCT/100)) return {reason:'+50% profit target',qty:remaining,partial:false};
  if (!trade.partialTaken && trade.contracts>1 && bid >= trade.entryPremium*(1+IWM_PARTIAL_TARGET_PCT/100)) {
    return {reason:'+35% partial profit',qty:Math.min(remaining,Math.max(1,Math.floor(trade.contracts/2))),partial:true};
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
}