import { describe,it,expect,vi } from "vitest";
import { runPulseOwner } from "@/lib/server/pulse-engine.server";
import { defaultPulseConfig } from "@/lib/pulse-bots/config";

const config={...defaultPulseConfig("orb"),name:"Opening Bell",allocation:200};
const position={symbol:"SPY",underlying:"SPY",instrument:"shares",side:"long",qty:2,entryPrice:10,peakGainPct:0,floorPct:null,openedBarTime:"2026-10-23T14:00:00Z"};
function harness(initial:any={},overrides:any={}){
  let state:any={initialized:true,allocation:200,balance:200,bankedTotal:0,cycles:0,day:"2026-10-23",dayBalance:200,pnlToday:0,trades:0,memo:{},lastBars:{},...initial};
  const events:any[]=[];
  const row={id:"bot-a",user_id:"owner",config,enabled:true,kill_switch:false,...overrides};
  const db:any={rpc:vi.fn(async(name:string,args:any)=>{if(name==="pulse_acquire_lease")return {data:true};state=structuredClone(args.p_state);return {error:null};}),from:vi.fn((table:string)=>{
    const values=()=>({data:table==="pulse_bot_configs"?[row]:table==="pulse_bot_states"?[{bot_id:"bot-a",state:structuredClone(state)}]:[],error:null});
    const q:any={select:()=>q,eq:()=>q,order:async()=>values(),maybeSingle:async()=>({data:null,error:null}),then:(resolve:any)=>Promise.resolve(values()).then(resolve),update:()=>q,insert:async(e:any)=>{events.push(e);return {error:null};}};return q;
  })};
  const api:any={clock:vi.fn(async()=>({timestamp:"2026-10-23T14:10:00Z",is_open:true,next_close:"2026-10-23T20:00:00Z"})),positions:vi.fn(async()=>state.position?[{symbol:"SPY",qty:String(state.position.qty)}]:[]),findOrder:vi.fn(async()=>null),order:vi.fn(),submit:vi.fn(async()=>({id:"order-1"})),cancel:vi.fn(),account:vi.fn(async()=>({equity:"100000",buying_power:"100000"})),call:vi.fn(async(path:string)=>path.includes("/bars?")?{bars:{SPY:[]}}:path.includes("/quotes/")?{quotes:{SPY:{bp:9,ap:9.1,t:"2026-10-23T14:10:00Z"}}}:[])};
  return {db,api,events,state:()=>state};
}
describe("separate paper bot lifecycle",()=>{
  it("writes exit intent before broker submission",async()=>{
    const h=harness({position},{enabled:false});
    h.api.submit.mockImplementation(async(body:any)=>{expect(h.state().pending.body).toEqual(body);expect(h.state().pending.clientId).toMatch(/^pulse-/);throw new Error("interrupted");});
    await runPulseOwner(h.db,"owner",h.api);expect(h.state().pending.kind).toBe("exit");expect(h.state().position.qty).toBe(2);
  });
  it("flattens disabled bots even when quote/history calls fail",async()=>{
    const h=harness({position},{enabled:false});h.api.call.mockRejectedValue(new Error("no quotes"));
    await runPulseOwner(h.db,"owner",h.api);expect(h.api.submit).toHaveBeenCalledWith(expect.objectContaining({symbol:"SPY",qty:"2",side:"sell",type:"market"}));expect(h.state().pending.reason).toBe("Bot stopped");
  });
  it("reconciles an existing broker client ID without duplicate submission",async()=>{
    const h=harness({pending:{kind:"entry",clientId:"pulse-existing",at:"2026-10-23T14:10:00Z",barTime:"2026-10-23T14:05:00Z",body:{symbol:"SPY"},position:{symbol:"SPY",underlying:"SPY",instrument:"shares",side:"long"}}});
    h.api.findOrder.mockResolvedValue({id:"existing",status:"filled",filled_qty:"2",filled_avg_price:"10"});
    h.api.call.mockImplementation(async(path:string)=>path.includes("/bars?")?{bars:{SPY:[]}}:{quotes:{SPY:{bp:10,ap:10.1,t:"2026-10-23T14:10:00Z"}}});
    await runPulseOwner(h.db,"owner",h.api);expect(h.api.submit).not.toHaveBeenCalled();expect(h.state().position.qty).toBe(2);expect(h.state().trades).toBe(1);
  });
  it("waits for terminal cancellation before accounting a partial fill",async()=>{
    const h=harness({pending:{kind:"entry",id:"existing",clientId:"pulse-existing",at:"2026-10-23T14:08:00Z",body:{symbol:"SPY"}}});
    h.api.order.mockResolvedValue({id:"existing",status:"partially_filled",filled_qty:"1"});h.api.cancel.mockResolvedValue({id:"existing",status:"pending_cancel",filled_qty:"1"});
    await runPulseOwner(h.db,"owner",h.api);expect(h.state().pending.id).toBe("existing");expect(h.state().position).toBeUndefined();expect(h.api.submit).not.toHaveBeenCalled();
  });
  it("accounts filled exit quantities once and preserves remaining exposure",async()=>{
    const h=harness({position:{...position,qty:2},pending:{kind:"exit",id:"exit",clientId:"pulse-exit",at:"2026-10-23T14:10:00Z",reason:"stop",body:{symbol:"SPY"}}},{enabled:false});
    h.api.order.mockImplementation(async(id:string)=>id==="exit"?{id:"exit",status:"canceled",filled_qty:"1",filled_avg_price:"9"}:{id,status:"new",filled_qty:"0"});
    await runPulseOwner(h.db,"owner",h.api);expect(h.state().balance).toBe(199);expect(h.state().pnlToday).toBe(-1);expect(h.state().position.qty).toBe(1);expect(h.api.submit).toHaveBeenCalledWith(expect.objectContaining({qty:"1"}));
  });
  it("uses the early-close time to flatten ten minutes before close",async()=>{
    const h=harness({position});h.api.clock.mockResolvedValue({timestamp:"2026-11-27T17:50:00Z",is_open:true,next_close:"2026-11-27T18:00:00Z"});
    await runPulseOwner(h.db,"owner",h.api);expect(h.state().pending.reason).toBe("Session flatten");
  });
  it("keeps opted-in bots waiting during market closure without submitting",async()=>{
    const h=harness();h.api.clock.mockResolvedValue({timestamp:"2026-10-24T14:00:00Z",is_open:false,next_close:"2026-10-26T20:00:00Z"});
    await runPulseOwner(h.db,"owner",h.api);expect(h.state().note).toBe("Market closed");expect(h.api.submit).not.toHaveBeenCalled();
  });
  it("does not run after lease contention",async()=>{
    const h=harness();h.db.rpc.mockResolvedValue({data:false});await runPulseOwner(h.db,"owner",h.api);expect(h.api.clock).not.toHaveBeenCalled();
  });
});