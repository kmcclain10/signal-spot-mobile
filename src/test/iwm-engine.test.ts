import { describe, it, expect, vi } from "vitest";
import { runIwmUser } from "@/lib/server/iwm-engine.server";

const settings={user_id:"user-a",enabled:true,timeframe_min:2,starting_bankroll:200,bank_trigger:25200,stop_loss_pct:30,max_trades_per_day:15,force_exit_time:"15:50",discord_enabled:false,data_feed:"iex",options_feed:"indicative"};
function harness(initial:any={}) {
  let state:any={user_id:"user-a",balance:200,banked_total:0,cycles:1,trading_day:"2026-10-16",alerted_keys:[],trades_today:0,pnl_today:0,wins_today:0,losses_today:0,banked_today:0,open_trade:null,pending_order:null,...initial};
  const writes:any={};
  const db={rpc:vi.fn(async(name:string,args:any)=> {
    if(name==="iwm_acquire_lock") return {data:[structuredClone(state)]};
    state=structuredClone(args.p_state);
    for(const [key,rows] of Object.entries(args.p_events)) (writes[key] ??= []).push(...rows as any[]);
    return {error:null};
  }),from:vi.fn(()=>({update:vi.fn(()=>({eq:vi.fn(()=>({eq:vi.fn(async()=>({error:null}))}))}))}))};
  const api:any={connectionId:"paper-connection",clock:vi.fn(async()=>({timestamp:"2026-10-16T14:10:00Z",is_open:true,next_close:"2026-10-16T20:00:00Z"})),
    order:vi.fn(),findOrder:vi.fn(async()=>null),submit:vi.fn(async()=>({id:"exit-order"})),cancel:vi.fn(),
    quote:vi.fn(async()=>({bp:0.69,ap:0.7,t:"2026-10-16T14:10:00Z"})),bars:vi.fn(async()=>[])};
  return {db,api,writes,state:()=>state};
}
const intent={id:"buy-order",side:"buy",client_id:"iwm-buy",submitted_at:"2026-10-16T14:08:00Z",connection_id:"paper-connection",trade_id:"trade-a",signal_id:"signal-a",
  signal:{side:"CALL",window:1,price:273,barTime:"2026-10-16T14:04:00Z"},contract:{symbol:"IWM261016C00273000",strike:273,expiry:"2026-10-16"},body:{side:"buy"}};
describe("paper IWM order lifecycle",()=> {
  it('submits an ATM paper order on the first confirmed one-minute cross',async()=> {
    const h=harness();
    const bars=Array.from({length:30},(_,i)=>({t:new Date(Date.parse('2026-10-16T13:40:00Z')+i*60000).toISOString(),o:i===29?100:101,h:i===29?110:102,l:99,c:i===29?110:100}));
    h.api.bars.mockResolvedValue(bars);h.api.chooseContract=vi.fn(async()=>({symbol:'IWM261016C00110000',strike:110,expiry:'2026-10-16',ask:1,bid:0.99}));
    await runIwmUser(h.db,settings,h.api);
    expect(h.api.chooseContract).toHaveBeenCalledWith('CALL',110,'2026-10-16','indicative',expect.any(Date),'IWM',true);
    expect(h.api.submit).toHaveBeenCalledWith(expect.objectContaining({side:'buy',qty:'2',position_intent:'buy_to_open'}));
    expect(h.writes.signals[0]).toMatchObject({kind:'entry',bar_time:'2026-10-16T14:09:00.000Z'});
  });
  it('retries only the unfilled half-profit quantity, not the whole position',async()=> {
    const trade={side:'CALL',optionSymbol:intent.contract.symbol,strike:273,contracts:4,entryPremium:1,peakPremium:1.35,entryCloseTime:'2026-10-16T14:05:00Z',connectionId:'paper-connection',tradeRow:{id:'trade-a',entry_time:'2026-10-16T14:08:00Z',window:1},exitFilledQty:0,exitValue:0};
    const h=harness({open_trade:trade,pending_order:{id:'partial-order',side:'sell',client_id:'partial-client',submitted_at:'2026-10-16T14:08:00Z',reason:'+35% partial profit',partial:true,targetFilledQty:2,body:{side:'sell',qty:'2'}}});
    h.api.order.mockResolvedValue({id:'partial-order',status:'canceled',filled_qty:'1',filled_avg_price:'1.35'});
    h.api.quote.mockResolvedValue({bp:1.35,ap:1.36,t:'2026-10-16T14:10:00Z'});
    await runIwmUser(h.db,settings,h.api);
    expect(h.state().pending_order.body.qty).toBe('1');expect(h.state().pending_order.targetFilledQty).toBe(2);
    expect(h.state().open_trade.exitFilledQty).toBe(1);
  });
  it('sells half at +35%, retains the runner, and keeps the runner open past +50%',async()=> {
    const h=harness({pending_order:intent});
    h.api.order.mockResolvedValue({id:'buy-order',status:'filled',filled_qty:'4',filled_avg_price:'1',filled_at:'2026-10-16T14:08:00Z'});
    h.api.quote.mockResolvedValue({bp:1.35,ap:1.36,t:'2026-10-16T14:10:00Z'});
    await runIwmUser(h.db,settings,h.api);
    expect(h.state().pending_order.body.qty).toBe('2');
    h.api.order.mockResolvedValue({id:'exit-order',status:'filled',filled_qty:'2',filled_avg_price:'1.35',filled_at:'2026-10-16T14:10:05Z'});
    await runIwmUser(h.db,settings,h.api);
    expect(h.state().open_trade.partialTaken).toBe(true); expect(h.state().open_trade.exitFilledQty).toBe(2);
    expect(h.state().pending_order).toBeNull(); expect(h.api.submit).toHaveBeenCalledTimes(1);
    h.api.quote.mockResolvedValue({bp:1.5,ap:1.51,t:'2026-10-16T14:10:00Z'});
    await runIwmUser(h.db,settings,h.api);
    expect(h.state().pending_order).toBeNull(); expect(h.state().open_trade.exitFilledQty).toBe(2);
  });
  it('keeps the trade open past the entry window end (window filters entries only)',async()=> {
    const h=harness({pending_order:intent});
    h.api.order.mockResolvedValue({id:'buy-order',status:'filled',filled_qty:'1',filled_avg_price:'1',filled_at:'2026-10-16T14:08:00Z'});
    h.api.clock.mockResolvedValue({timestamp:'2026-10-16T14:19:00Z',is_open:true,next_close:'2026-10-16T20:00:00Z'});
    h.api.quote.mockRejectedValue(new Error('no quote'));
    await runIwmUser(h.db,settings,h.api);
    expect(h.api.submit).not.toHaveBeenCalledWith(expect.objectContaining({side:'sell'}));
    expect(h.state().open_trade).not.toBeNull();
  });
  it('cancels an unfilled entry before the window closes instead of adding exposure',async()=> {
    const h=harness({pending_order:{...intent,submitted_at:'2026-10-16T14:18:45Z'}});
    h.api.clock.mockResolvedValue({timestamp:'2026-10-16T14:19:00Z',is_open:true,next_close:'2026-10-16T20:00:00Z'});
    h.api.order.mockResolvedValue({id:'buy-order',status:'new',filled_qty:'0'});
    h.api.cancel.mockResolvedValue({id:'buy-order',status:'canceled',filled_qty:'0'});
    await runIwmUser(h.db,settings,h.api);
    expect(h.api.cancel).toHaveBeenCalledWith('buy-order'); expect(h.api.submit).not.toHaveBeenCalled();
    expect(h.state().pending_order).toBeNull();
  });
  it("creates a position only from a confirmed buy fill and requests the latest -20% stop",async()=> {
    const h=harness({pending_order:intent});h.api.order.mockResolvedValue({id:"buy-order",status:"filled",filled_qty:"2",filled_avg_price:"1",filled_at:"2026-10-16T14:08:00Z"});
    await runIwmUser(h.db,settings,h.api);
    expect(h.state().open_trade.contracts).toBe(2);expect(h.state().trades_today).toBe(1);
    expect(h.api.submit).toHaveBeenCalledWith(expect.objectContaining({side:"sell",qty:"2",position_intent:"sell_to_close",limit_price:"0.69"}));
    expect(h.state().pending_order.reason).toBe("-20% option stop");
    h.api.order.mockResolvedValue({id:"exit-order",status:"filled",filled_qty:"2",filled_avg_price:"0.69",filled_at:"2026-10-16T14:10:00Z"});
    await runIwmUser(h.db,settings,h.api);
    expect(h.state().balance).toBe(138);expect(h.state().pnl_today).toBe(-62);expect(h.state().losses_today).toBe(1);
    expect(h.state().open_trade).toBeNull();expect(h.state().pending_order).toBeNull();
    expect(h.writes.trades.at(-1)).toMatchObject({status:"closed",pnl:-62,contracts:2,exit_premium:0.69});
  });
  it("does not resend when cancellation has not become terminal",async()=> {
    const h=harness({pending_order:intent});h.api.order.mockResolvedValue({id:"buy-order",status:"partially_filled",filled_qty:"1"});
    h.api.cancel.mockResolvedValue({id:"buy-order",status:"pending_cancel",filled_qty:"1"});
    await runIwmUser(h.db,settings,h.api);
    expect(h.api.submit).not.toHaveBeenCalled();expect(h.state().pending_order.id).toBe("buy-order");expect(h.state().open_trade).toBeNull();
  });
  it("keeps monitoring and force-exits even after user disables new entries",async()=> {
    const h=harness({pending_order:intent});h.api.order.mockResolvedValue({id:"buy-order",status:"filled",filled_qty:"1",filled_avg_price:"1"});
    h.api.clock.mockResolvedValue({timestamp:"2026-10-16T19:50:00Z",is_open:true,next_close:"2026-10-16T20:00:00Z"});h.api.quote.mockRejectedValue(new Error("no quote"));
    await runIwmUser(h.db,{...settings,enabled:false},h.api);
    expect(h.api.submit).toHaveBeenCalledWith(expect.objectContaining({side:"sell",type:"market",qty:"1"}));
    expect(h.state().pending_order.reason).toBe("Force exit before market close");
  });
  it("saves a recoverable order intent before the broker submission",async()=> {
    const h=harness({pending_order:intent});h.api.order.mockResolvedValue({id:"buy-order",status:"filled",filled_qty:"1",filled_avg_price:"1"});
    h.api.submit.mockImplementation(async()=> {
      expect(h.state().pending_order.side).toBe("sell");expect(h.state().pending_order.client_id).toBeTruthy();
      throw new Error("simulated timeout");
    });
    const result=await runIwmUser(h.db,settings,h.api);
    expect(result.status).toBe("error");expect(h.state().pending_order.side).toBe("sell");expect(h.state().open_trade.contracts).toBe(1);
  });
  it("writes daily report only once after 16:05 and only after positions are closed",async()=> {
    const h=harness({last_bar_time:"2026-10-16T19:58:00Z",trades_today:2,wins_today:1,losses_today:1,pnl_today:20,balance:220});
    h.api.clock.mockResolvedValue({timestamp:"2026-10-16T20:05:00Z",is_open:false,next_close:"2026-10-19T20:00:00Z"});
    await runIwmUser(h.db,settings,h.api);await runIwmUser(h.db,settings,h.api);
    expect(h.writes.reports).toHaveLength(1);expect(h.writes.reports[0]).toMatchObject({day:"2026-10-16",trades:2,win_rate:0.5,pnl:20,ending_bankroll:220});
  });
  it("cancels a sell after 30 seconds and resends only unfilled contracts with a new broker client ID",async()=> {
    const h=harness({pending_order:intent});
    h.api.order.mockResolvedValue({id:"buy-order",status:"filled",filled_qty:"2",filled_avg_price:"1"});
    await runIwmUser(h.db,settings,h.api);
    const firstClientId=h.state().pending_order.client_id;
    h.api.clock.mockResolvedValue({timestamp:"2026-10-16T14:11:00Z",is_open:true,next_close:"2026-10-16T20:00:00Z"});
    h.api.order.mockResolvedValue({id:"exit-order",status:"partially_filled",filled_qty:"1",filled_avg_price:"0.69"});
    h.api.cancel.mockResolvedValue({id:"exit-order",status:"canceled",filled_qty:"1",filled_avg_price:"0.69"});
    await runIwmUser(h.db,settings,h.api);
    const replacement=h.state().pending_order;
    expect(replacement.client_id).not.toBe(firstClientId);
    expect(replacement.body.client_order_id).toBe(replacement.client_id);
    expect(replacement.body).toMatchObject({qty:"1",side:"sell",type:"market"});
    expect(h.state().open_trade.exitFilledQty).toBe(1);
  });
});