import { describe,it,expect } from 'vitest';
import { crossEntry,profitAction,profitableReversal,nearestAtmContracts } from '@/lib/iwm-trade-policy';
import { DEFAULT_CONFIG,type IndRow } from '@/lib/iwmWindowStrategy';
const cfg={...DEFAULT_CONFIG,timeframeMin:1};
const row:IndRow={t:'2026-10-16T15:02:00Z',o:100,h:102,l:99,c:101,emaFast:101,emaSlow:100,bullCross:true,bearCross:false,bullDot:false,bearDot:false,osc:0,green:true,red:false};
const trade={contracts:5,entryPremium:1,exitFilledQty:0,side:'CALL',entryCloseTime:'2026-10-16T14:03:00Z'};
describe('latest IWM trade policy',()=> {
  it('enters on the confirmed cross without waiting for a third candle or oscillator dot',()=>expect(crossEntry(row,new Set(),cfg)[0]).toMatchObject({kind:'entry',side:'CALL',barTime:row.t}));
  it('mirrors the cross for puts',()=>expect(crossEntry({...row,bullCross:false,bearCross:true},new Set(),cfg)[0]?.side).toBe('PUT'));
  it('does not duplicate a cross',()=>{const seen=new Set<string>();crossEntry(row,seen,cfg);expect(crossEntry(row,seen,cfg)).toEqual([]);});
  it('blocks new entries in the 11:30–1:30 ET midday lull',()=>{expect(crossEntry({...row,t:'2026-10-16T15:35:00Z'},new Set(),cfg)).toEqual([]);expect(crossEntry({...row,t:'2026-10-16T17:29:00Z'},new Set(),cfg)).toEqual([]);expect(crossEntry({...row,t:'2026-10-16T17:30:00Z'},new Set(),cfg)).toHaveLength(1);});
  it('no partial sell: holds at +35%',()=>expect(profitAction({...trade,peakPremium:1.35},1.35)).toBeNull());
  it('holds at -15% and requests the theoretical stop at -20%',()=>{expect(profitAction(trade,0.85)).toBeNull();expect(profitAction(trade,0.8)).toMatchObject({qty:5,reason:'-20% option stop'});});
  it('no trailing lock before +15% peak',()=>expect(profitAction({...trade,peakPremium:1.14},1.01)).toBeNull());
  it('after +15% the floor is break-even',()=>{const t={...trade,peakPremium:1.15};expect(profitAction(t,1.01)).toBeNull();expect(profitAction(t,1.0)).toMatchObject({qty:5,partial:false});});
  it('trails 12 points below an +80% peak',()=>{const t={...trade,peakPremium:1.8};expect(profitAction(t,1.69)).toBeNull();expect(profitAction(t,1.68)).toMatchObject({qty:5});});
  it('exits first CALL reversal only when profitable',()=>{const reversal={...row,t:'2026-10-16T14:04:00Z',red:true,green:false};expect(profitableReversal(trade,reversal,1.01)).toBe(true);expect(profitableReversal(trade,reversal,0.9)).toBe(false);});
  it('exits profitable PUT on its first green candle',()=>expect(profitableReversal({...trade,side:'PUT'},{...row,t:'2026-10-16T14:04:00Z'},1.01)).toBe(true));
  it('only selects the closest ATM strike rather than substituting farther strikes',()=>expect(nearestAtmContracts([{strike_price:279},{strike_price:280},{strike_price:281}],280.2)).toEqual([{strike_price:280}]));
});
import { emaCloseBreak, emaCrossBack, savingsAmount } from '@/lib/iwm-trade-policy';
describe('8 EMA close break and WMT savings', () => {
  const trade = { side: 'CALL', entryCloseTime: '2026-10-29T15:12:00Z' };
  const row = (c: number, t = '2026-10-29T15:13:00Z') => ({ t, c, emaFast: 280 } as any);
  it('exits a CALL when a closed bar closes below the 8 EMA', () => { expect(emaCloseBreak(trade, row(279.99))).toBe(true); });
  it('holds a CALL closing above the 8 EMA', () => { expect(emaCloseBreak(trade, row(280.01))).toBe(false); });
  it('exits a PUT closing above the 8 EMA', () => { expect(emaCloseBreak({ ...trade, side: 'PUT' }, row(280.01))).toBe(true); });
  it('ignores bars before the entry bar closed', () => { expect(emaCloseBreak(trade, row(279, '2026-10-29T15:10:00Z'))).toBe(false); });
  it('exits a CALL when the 8 EMA crosses back under the 20', () => { const r={t:'2026-10-29T15:15:00Z',emaFast:279.9,emaSlow:280} as any; expect(emaCrossBack(trade,r)).toBe(true); expect(emaCrossBack(trade,{...r,emaFast:280.1})).toBe(false); expect(emaCrossBack({...trade,side:'PUT'},{...r,emaFast:280.1})).toBe(true); });
  it('saves half of a profitable day, e.g. $94 -> $47', () => { expect(savingsAmount(94)).toBe(47); });
  it('saves nothing on a losing day or under $1', () => { expect(savingsAmount(-16)).toBe(0); expect(savingsAmount(1.5)).toBe(0); });
});
import { takeTheBid } from '@/lib/iwm-trade-policy';
describe('take the bid',()=>{
  it('sells at market when in profit with a 2-cent spread',()=>expect(takeTheBid(0.33,0.45,0.47)).toBe(true));
  it('keeps a limit when the spread is 3 cents',()=>expect(takeTheBid(0.33,0.45,0.48)).toBe(false));
  it('keeps a limit when not in profit',()=>expect(takeTheBid(0.5,0.45,0.46)).toBe(false));
});
