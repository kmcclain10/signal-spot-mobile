import { describe,it,expect } from 'vitest';
import { crossEntry,profitAction,profitableReversal,nearestAtmContracts } from '@/lib/iwm-trade-policy';
import { DEFAULT_CONFIG,type IndRow } from '@/lib/iwmWindowStrategy';
const cfg={...DEFAULT_CONFIG,timeframeMin:1};
const row:IndRow={t:'2026-10-16T14:02:00Z',o:100,h:102,l:99,c:101,emaFast:101,emaSlow:100,bullCross:true,bearCross:false,bullDot:false,bearDot:false,osc:0,green:true,red:false};
const trade={contracts:5,entryPremium:1,exitFilledQty:0,side:'CALL',entryCloseTime:'2026-10-16T14:03:00Z'};
describe('latest IWM trade policy',()=> {
  it('enters on the confirmed cross without waiting for a third candle or oscillator dot',()=>expect(crossEntry(row,new Set(),cfg)[0]).toMatchObject({kind:'entry',side:'CALL',barTime:row.t}));
  it('mirrors the cross for puts',()=>expect(crossEntry({...row,bullCross:false,bearCross:true},new Set(),cfg)[0]?.side).toBe('PUT'));
  it('does not duplicate a cross',()=>{const seen=new Set<string>();crossEntry(row,seen,cfg);expect(crossEntry(row,seen,cfg)).toEqual([]);});
  it('forbids final-minute cross entry',()=>expect(crossEntry({...row,t:'2026-10-16T14:19:00Z'},new Set(),cfg)).toEqual([]));
  it('sells half rounded down at exactly +35%',()=>expect(profitAction(trade,1.35)).toMatchObject({qty:2,partial:true}));
  it('exits remaining contracts at exactly +50%',()=>expect(profitAction({...trade,exitFilledQty:2,partialTaken:true},1.5)).toMatchObject({qty:3,partial:false,reason:'+50% profit target'}));
  it('holds at -15% and requests the theoretical stop at -20%',()=>{expect(profitAction(trade,0.85)).toBeNull();expect(profitAction(trade,0.8)).toMatchObject({qty:5,reason:'-20% option stop'});});
  it('cannot partially sell one contract',()=>expect(profitAction({...trade,contracts:1},1.35)).toBeNull());
  it('exits first CALL reversal only when profitable',()=>{const reversal={...row,t:'2026-10-16T14:04:00Z',red:true,green:false};expect(profitableReversal(trade,reversal,1.01)).toBe(true);expect(profitableReversal(trade,reversal,0.9)).toBe(false);});
  it('exits profitable PUT on its first green candle',()=>expect(profitableReversal({...trade,side:'PUT'},{...row,t:'2026-10-16T14:04:00Z'},1.01)).toBe(true));
  it('only selects the closest ATM strike rather than substituting farther strikes',()=>expect(nearestAtmContracts([{strike_price:279},{strike_price:280},{strike_price:281}],280.2)).toEqual([{strike_price:280}]));
});