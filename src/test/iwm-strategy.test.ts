import { describe, it, expect } from "vitest";
import { DEFAULT_CONFIG, evaluate, windowOf, isFinalBar, protectedFloor, onPremium, emaDisrespect, contractsFor, settle, occSymbol, type IndRow, type OpenTrade } from "@/lib/iwmWindowStrategy";
import { requireIwmPaper, closedRegularBars, iwmScheduleTime, terminalOrder } from "@/lib/iwm-engine-rules";
const row = (minute: number, patch: Partial<IndRow> = {}): IndRow => ({ t: `2026-10-16T14:${String(minute).padStart(2,"0")}:00Z`, o:270,h:272,l:269,c:271,emaFast:270.5,emaSlow:270,bullCross:false,bearCross:false,osc:-1,bullDot:false,bearDot:false,green:true,red:false,...patch });
const trade = (): OpenTrade => ({ side:"CALL",optionSymbol:"IWM261016C00273000",strike:273,contracts:1,entryPremium:1,peakPremium:1,floorPct:null,entryCloseTime:"2026-10-16T14:06:00Z" });
describe("supplied IWM rules", () => {
  it("defaults to 2-minute bars, 8/20 EMAs and oscillator 15", () => expect([DEFAULT_CONFIG.timeframeMin,DEFAULT_CONFIG.emaFast,DEFAULT_CONFIG.emaSlow,DEFAULT_CONFIG.oscLength]).toEqual([2,8,20,15]));
  it("has fifteen windows from 10:00 to 15:00 ET including DST", () => {
    expect(windowOf("2026-10-16T13:59:00Z")).toBeNull(); expect(windowOf("2026-10-16T14:00:00Z")).toBe(1);
    expect(windowOf("2026-10-16T18:59:00Z")).toBe(15); expect(windowOf("2026-10-16T19:00:00Z")).toBeNull();
    expect(windowOf("2026-12-16T15:00:00Z")).toBe(1);
  });
  it("enters exactly on third consecutive green candle counted from cross", () => {
    const r=[row(0,{bullCross:true}),row(2,{bullDot:true}),row(4)];
    expect(evaluate(r.slice(0,2),new Set()).map(s=>s.kind)).toEqual(["potential"]);
    expect(evaluate(r,new Set()).map(s=>s.kind)).toEqual(["potential","entry"]);
    expect(evaluate([...r,row(6)],new Set()).map(s=>s.kind)).toEqual(["potential"]);
  });
  it("requires same-window cross and dot", () => {
    expect(evaluate([row(0,{bullCross:true}),row(2),row(4)],new Set())).toEqual([]);
    expect(evaluate([row(0,{bullCross:true,bullDot:true}),row(20),row(22),row(24)],new Set())).toEqual([]);
  });
  it("requires aligned EMAs", () => expect(evaluate([row(0,{bullCross:true}),row(2,{bullDot:true}),row(4,{emaFast:269})],new Set())).toEqual([]));
  it("mirrors the rules for exactly three red PUT candles", () => {
    const r=[0,2,4].map((m,i)=>row(m,{emaFast:269,green:false,red:true,bearCross:i===0,bearDot:i===1}));
    expect(evaluate(r,new Set()).filter(s=>s.kind==="entry").map(s=>s.side)).toEqual(["PUT"]);
  });
  it("never enters on final window bar", () => {
    expect(isFinalBar(row(18).t)).toBe(true);
    expect(evaluate([row(14,{bullCross:true}),row(16,{bullDot:true}),row(18)],new Set()).map(s=>s.kind)).toEqual(["potential"]);
  });
  it("fires only once per window per side per kind", () => {
    const r=[row(0,{bullCross:true}),row(2,{bullDot:true}),row(4)], keys=new Set<string>();
    expect(evaluate(r,keys)).toHaveLength(2); expect(evaluate(r,keys)).toEqual([]);
  });
  it("locks +10 at +35 then +10 every +10 peak forever", () => expect([34.99,35,44.99,45,55,1035].map(p=>protectedFloor(p))).toEqual([null,10,10,20,30,1010]));
  it("exits at -30% premium", () => expect(onPremium(trade(),0.69).exitReason).toBe("-30% option stop"));
  it("never lowers protection and exits on floor breach", () => {
    const t=trade(); expect(onPremium(t,1.46).newFloor).toBe(20); expect(onPremium(t,1.3).newFloor).toBeNull();
    expect(t.floorPct).toBe(20); expect(onPremium(t,1.19).exitReason).toBe("protected floor +20% breached");
  });
  it("exits wrong-side EMA closes only after entry close time", () => {
    expect(emaDisrespect(trade(),row(4,{c:269}))).toBeNull(); expect(emaDisrespect(trade(),row(6,{c:269}))).toContain("8 EMA disrespect");
  });
  it("opposite oscillator dots are NOT exits", () => expect(emaDisrespect(trade(),row(6,{bearDot:true}))).toBeNull());
  it("sizes contracts from $200 at 100 shares per contract", () => {
    expect(contractsFor({balance:200,bankedTotal:0,cycles:1},0.75)).toBe(2); expect(contractsFor({balance:200,bankedTotal:0,cycles:1},2.01)).toBe(0);
  });
  it("banks everything above $200 at $25,200", () => {
    const b={balance:25100,bankedTotal:0,cycles:1}; expect(settle(b,99)).toBeNull(); expect(settle(b,1)).toBe(25000);
    expect(b).toEqual({balance:200,bankedTotal:25000,cycles:2});
  });
  it("formats OCC symbols", () => expect(occSymbol("IWM","2026-10-16","CALL",273)).toBe("IWM261016C00273000"));
  it("rejects live or custom trading endpoints", () => {
    expect(requireIwmPaper({provider:"alpaca",environment:"paper"})).toBe("https://paper-api.alpaca.markets");
    expect(()=>requireIwmPaper({provider:"alpaca",environment:"live"})).toThrow();
    expect(()=>requireIwmPaper({provider:"alpaca",environment:"paper",config:{base_url:"https://api.alpaca.markets"}})).toThrow();
  });
  it("drops unfinished and non-regular bars", () => expect(closedRegularBars([row(0),row(2),{...row(0),t:"2026-10-16T13:00:00Z"}],new Date("2026-10-16T14:03:00Z"),DEFAULT_CONFIG).map(b=>b.t)).toEqual([row(0).t]));
  it("skips weekends and stays active for 16:05 reports", () => {
    expect(iwmScheduleTime(new Date("2026-10-17T14:00:00Z"))).toBe(false); expect(iwmScheduleTime(new Date("2026-10-16T20:05:00Z"))).toBe(true);
  });
  it("does not treat pending cancellation as final", () => { expect(terminalOrder("pending_cancel")).toBe(false); expect(terminalOrder("canceled")).toBe(true); });
});