import { describe, it, expect } from "vitest";
import { activityCsv, buildActivity, filterActivity } from "@/lib/activity-rules";

const input = {
  fills: [
    { id: "f1", symbol: "AAPL", side: "buy", filledQty: 2, filledAvgPrice: 250, filledAt: "2026-10-23T14:00:00Z" },
    { id: "f2", symbol: "SPY", side: "sell", filledQty: 1, filledAvgPrice: 600, filledAt: null }, // not filled yet — excluded
  ],
  sent: [{ id: "s1", symbol: "AAPL", side: "buy", qty: 2, stop: 245, environment: "paper", created_at: "2026-10-23T13:59:00Z" }],
  botTrades: [
    { id: "t1", strike: 273, side: "CALL", contracts: 2, entry_premium: 1, entry_time: "2026-10-23T15:00:00Z", exit_time: "2026-10-23T16:00:00Z", exit_reason: "-30% option stop", pnl: -62 },
    { id: "t2", strike: 270, side: "PUT", contracts: 1, entry_premium: 0.5, entry_time: "2026-10-23T17:00:00Z", exit_time: null },
  ],
  botBanks: [{ id: "b1", amount_banked: 25000, new_cycle: 2, restart_balance: 200, created_at: "2026-10-23T20:05:00Z" }],
};

describe("buildActivity", () => {
  const items = buildActivity(input);
  it("merges every source, skipping unfilled orders and open trades' exits", () => {
    expect(items.map((i) => i.kind)).toEqual(["bot-bank", "bot-entry", "bot-exit", "bot-entry", "fill", "order"]);
  });
  it("sorts newest first", () => {
    expect(items[0].at).toBe("2026-10-23T20:05:00Z");
    expect(items.at(-1)?.at).toBe("2026-10-23T13:59:00Z");
  });
  it("carries the exit P&L and banked amount", () => {
    expect(items.find((i) => i.kind === "bot-exit")?.amount).toBe(-62);
    expect(items.find((i) => i.kind === "bot-bank")?.amount).toBe(25000);
  });
});

describe("filterActivity", () => {
  it("includes separate bot fills, banking, alerts and errors",()=>{
    const kinds=["entry","exit","bank","signal","error"];
    const events=kinds.map((kind,i)=>({id:String(i),kind,created_at:`2026-10-24T15:0${i}:00Z`,detail:{symbol:"SPY",pnl:12.34,amount:25000}}));
    const items=buildActivity({fills:[],sent:[],botTrades:[],botBanks:[],pulseEvents:events});
    expect(filterActivity(items,"bot")).toHaveLength(5);
    expect(items.find(i=>i.kind==="bot-exit")?.amount).toBe(12.34);
    expect(items.find(i=>i.kind==="bot-bank")?.amount).toBe(25000);
  });
  const items = buildActivity(input);
  it("filters trades, bot and orders", () => {
    expect(filterActivity(items, "trades")).toHaveLength(1);
    expect(filterActivity(items, "bot")).toHaveLength(4);
    expect(filterActivity(items, "orders")).toHaveLength(1);
    expect(filterActivity(items, "all")).toHaveLength(6);
  });
});

describe("activityCsv", () => {
  it("emits a header and escapes commas and quotes", () => {
    const csv = activityCsv(buildActivity(input));
    const lines = csv.split("\n");
    expect(lines[0]).toBe("when,type,what,detail,amount");
    expect(lines).toHaveLength(7);
    expect(csv).toContain("2 contracts @ $1.00");
    expect(csv).toContain("-62.00");
    const quoted = activityCsv([{ id: "x", at: "2026-10-23T15:00:00Z", kind: "order", title: 'Buy, "now"', detail: "a,b", amount: null }]);
    expect(quoted).toContain('"Buy, ""now""","a,b"');
  });
});
