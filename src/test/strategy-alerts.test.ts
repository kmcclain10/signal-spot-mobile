import { describe,it,expect,vi } from 'vitest';
import { runStrategyAlerts } from '@/lib/server/strategy-alerts.server';
function harness(tier:string|null,isOpen:boolean){
  const upsert=vi.fn(()=>({select:async()=>({data:[],error:null})}));
  const db:any={rpc:vi.fn(async()=>({data:tier,error:null})),from:(table:string)=>{
    const result={data:table==='connections'?[{user_id:'owner'}]:table==='pulse_bot_configs'?[]:null,error:null};
    const q:any={select:()=>q,eq:()=>q,maybeSingle:async()=>result,then:(r:any)=>Promise.resolve(result).then(r),upsert};return q;
  }};
  const api:any={clock:vi.fn(async()=>({timestamp:'2026-11-12T15:00:00Z',is_open:isOpen})),call:vi.fn(async()=>({bars:{},next_page_token:null})),submit:vi.fn(),cancel:vi.fn()};
  const apiFor:any=vi.fn(async()=>api);return {db,api,apiFor,upsert};
}
describe('read-only strategy alerts',()=>{
  it('never contacts the broker for an unpaid account',async()=>{
    const h=harness(null,true);await runStrategyAlerts(h);expect(h.apiFor).not.toHaveBeenCalled();expect(h.upsert).not.toHaveBeenCalled();
  });
  it('skips closed-market evaluation without sending orders',async()=>{
    const h=harness('alerts',false);await runStrategyAlerts(h);expect(h.api.call).not.toHaveBeenCalled();expect(h.api.submit).not.toHaveBeenCalled();
  });
  it('evaluates actual market bars for Alerts tier without submitting or fabricating signals',async()=>{
    const h=harness('alerts',true);const r=await runStrategyAlerts(h);expect(h.api.call).toHaveBeenCalled();expect(h.upsert).not.toHaveBeenCalled();expect(h.api.submit).not.toHaveBeenCalled();expect(h.api.cancel).not.toHaveBeenCalled();expect(r.errors).toBe(0);
  });
  it('persists a real closed-bar IWM cross without placing any order',async()=>{
    const h=harness('alerts',true);
    const bars=Array.from({length:18},(_,i)=>({t:new Date(Date.parse('2026-11-12T13:30:00Z')+i*300000).toISOString(),o:100,h:i===17?110:102,l:99,c:i===17?110:100}));
    h.api.call.mockImplementation(async(path:string)=>({bars:path.includes('symbols=IWM')?{IWM:[...bars].reverse()}:{},next_page_token:null}));
    await runStrategyAlerts(h);
    expect(h.upsert).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({strategy_id:'iwm',symbol:'IWM',side:'long',price:110,bar_time:'2026-11-12T14:55:00.000Z'})]),expect.objectContaining({ignoreDuplicates:true}));
    expect(h.api.submit).not.toHaveBeenCalled();
  });
});