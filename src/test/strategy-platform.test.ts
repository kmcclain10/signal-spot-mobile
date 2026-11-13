import { describe,it,expect } from 'vitest';
import { PLAYBOOK,performanceStats,mergeRealSignals,canReceiveStrategyAlerts,type RealTrade,type RealSignal } from '@/lib/strategy-platform';
describe('real strategy platform',()=>{
  it('uses exactly eleven executable strategies and excludes legacy window20',()=>{
    expect(PLAYBOOK).toHaveLength(11);expect(new Set(PLAYBOOK.map(s=>s.id)).size).toBe(11);
    expect(PLAYBOOK.map(s=>s.id)).toContain('scalpers');expect(PLAYBOOK.map(s=>s.id)).not.toContain('window20');
  });
  it('allows Alerts and Bots subscribers to receive read-only triggers, not unpaid accounts',()=>{
    expect(canReceiveStrategyAlerts('alerts')).toBe(true);expect(canReceiveStrategyAlerts('bots')).toBe(true);expect(canReceiveStrategyAlerts(null)).toBe(false);
  });
  it('calculates actual realized returns, drawdown and durations without simulated values',()=>{
    const base:RealTrade={id:'a',strategy:'iwm',symbol:'IWM',at:'2026-11-12T15:00:00Z',entryAt:'2026-11-12T14:30:00Z',pnl:100,environment:'unrecorded',reason:'closed'};
    const s=performanceStats([base,{...base,id:'b',at:'2026-11-12T16:00:00Z',entryAt:'2026-11-12T15:00:00Z',pnl:-40}]);
    expect(s.pnl).toBe(60);expect(s.winRate).toBe(0.5);expect(s.profitFactor).toBe(2.5);expect(s.drawdown).toBe(40);expect(s.averageHold).toBe(45);
  });
  it('keeps missing performance undefined rather than fabricating results',()=>{
    const s=performanceStats([]);expect(s.winRate).toBeNull();expect(s.averageHold).toBeNull();expect(s.equity).toEqual([]);
  });
  it('shows one setup when scanner and runner share a bar, retaining the fill',()=>{
    const a:RealSignal={id:'a',strategy:'iwm',symbol:'IWM',side:'long',at:'2026-11-12T15:00:00Z',barTime:'2026-11-12T14:55:00Z',price:280,reason:'cross',status:'alert',environment:'live',feed:'iex',contract:null,fill:null};
    const b={...a,id:'b',status:'filled',contract:'IWM261112C00280000',fill:0.9};
    expect(mergeRealSignals([b,a])).toEqual([b]);
  });
});