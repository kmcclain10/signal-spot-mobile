import { describe,it,expect,vi } from "vitest";
import { STRATEGIES,resolveBotSettings,positionSize,ladderFloor,onMark, strategyExit,bankSettle, sma,ema,atr } from "@/lib/pulse-bots";
import { defaultPulseConfig,pulseConfigSchema,evaluatePulseBars,pulseEntryBlock } from "@/lib/pulse-bots/config";
import { isBotOrder,assertNoPulseOwnership } from "@/lib/bot-ownership";

describe("separate ZIP bot rules",()=>{
  it("contains nine separate strategies and does not accept a configurable IWM bot",()=>{
    expect(STRATEGIES.filter(s=>s.id!=="window20")).toHaveLength(9);
    expect(pulseConfigSchema.safeParse(defaultPulseConfig("window20")).success).toBe(false);
  });
  it("defaults new bots to disabled paper automation with $200 allocation",()=>{
    const c=defaultPulseConfig("orb");expect(c.enabled).toBe(false);expect(c.executionMode).toBe("auto");expect(c.allocation).toBe(200);
  });
  it("test risk is forbidden on live accounts",()=>{expect(()=>resolveBotSettings({...defaultPulseConfig("orb"),riskLevel:"test"},{isPaper:false})).toThrow("paper only");});
  it("balanced options use 30% stop, 35/10/10 ladder and 25% sizing",()=>{
    const s=resolveBotSettings({...defaultPulseConfig("orb"),instrument:"options"},{isPaper:true});
    expect(s.stopLossPct).toBe(30);expect(s.sizePct).toBe(25);expect(ladderFloor(35,s)).toBe(10);expect(ladderFloor(45,s)).toBe(20);expect(ladderFloor(345,s)).toBe(320);
  });
  it("sizes whole shares and contracts and skips unaffordable orders",()=>{
    expect(positionSize(200,10,{sizePct:25,instrument:"shares"})).toBe(5);
    expect(positionSize(200,0.5,{sizePct:25,instrument:"options"})).toBe(1);
    expect(positionSize(200,0.51,{sizePct:25,instrument:"options"})).toBe(0);
  });
  it("protects peak profits without lowering the floor",()=>{
    const s=resolveBotSettings({...defaultPulseConfig("orb"),instrument:"options"},{isPaper:true});
    const p={side:"long" as const,instrument:"options" as const,entryPrice:1,peakGainPct:0,floorPct:null,openedBarTime:"2026-10-23T14:00:00Z"};
    expect(onMark(p,1.46,null,s).newFloor).toBe(20);expect(onMark(p,1.3,null,s).exit).toBeNull();expect(onMark(p,1.19,null,s).exit).toContain("Profit floor");
  });
  it("ignores a strategy exit on the entry bar",()=>{
    const s=resolveBotSettings(defaultPulseConfig("orb"),{isPaper:true}),p={side:"long" as const,instrument:"shares" as const,entryPrice:10,peakGainPct:0,floorPct:null,openedBarTime:"2026-10-23T14:00:00Z"};
    expect(strategyExit(p,{exitLong:"wrong side"},p.openedBarTime,s)).toBeNull();expect(strategyExit(p,{exitLong:"wrong side"},"2026-10-23T14:05:00Z",s)).toBe("wrong side");
  });
  it("banks at 25200 and restarts at 200",()=>{const b={balance:25199,bankedTotal:0,cycles:0};expect(bankSettle(b,1,200,25200)).toBe(25000);expect(b).toEqual({balance:200,bankedTotal:25000,cycles:1});});
  it("guards empty bars without executing the supplied math",()=>{expect(evaluatePulseBars([],resolveBotSettings(defaultPulseConfig("orb"),{isPaper:true}),new Set()).entry).toBeUndefined();});
  it("enforces daily loss and trade caps",()=>{
    const s=resolveBotSettings(defaultPulseConfig("orb"),{isPaper:true}),input={enabled:true,kill:false,balance:200,pnlToday:0,dayBalance:200,trades:0,s};
    expect(pulseEntryBlock({...input,trades:6})).toBe("Daily trade limit reached");expect(pulseEntryBlock({...input,pnlToday:-8})).toBe("Daily loss limit reached");expect(pulseEntryBlock({...input,pnlToday:-7.99})).toBeNull();
  });
  it("rejects unsupported timeframes and non-finite risk",()=>{expect(pulseConfigSchema.safeParse({...defaultPulseConfig("orb"),timeframe:60}).success).toBe(false);expect(pulseConfigSchema.safeParse({...defaultPulseConfig("orb"),allocation:NaN}).success).toBe(false);});
  it("checks independent indicator values",()=>{expect(sma([1,2,3,4],3).slice(2)).toEqual([2,3]);expect(ema([1,2,3],3)).toEqual([1,1.5,2.25]);expect(atr([{t:"",o:10,h:12,l:8,c:10},{t:"",o:10,h:13,l:9,c:11}],2)[1]).toBe(4);});
});

describe("manual bot ownership",()=>{
  it("protects both order namespaces",()=>{expect(isBotOrder("pulse-123")).toBe(true);expect(isBotOrder("iwm-123")).toBe(true);expect(isBotOrder("manual-123")).toBe(false);});
  it("blocks shares and options for an enabled bot underlying",async()=>{
    const db={from:vi.fn((table:string)=>({select:()=>({eq:async()=>({data:table==="pulse_bot_configs"?[{enabled:true,config:{symbols:["SPY"]}}]:[],error:null})})}))};
    await expect(assertNoPulseOwnership(db,"owner","SPY")).rejects.toThrow("manages");await expect(assertNoPulseOwnership(db,"owner","SPY261023C00600000")).rejects.toThrow("manages");await expect(assertNoPulseOwnership(db,"owner","AAPL")).resolves.toBeUndefined();
  });
});