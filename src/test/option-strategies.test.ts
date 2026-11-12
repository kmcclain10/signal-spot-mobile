import { describe, it, expect } from "vitest";
import { buildLegs, payoff, mlegLegs, closeLegsProblem, strategyTicket, STRATEGIES } from "@/lib/option-strategies";
const q = (t: "C" | "P", k: number, bid: number, ask: number) => ({ contract: `IWM261120${t}${String(k * 1000).padStart(8, "0")}`, strike: k, bid, ask });
const near = { calls: [270, 275, 280, 285, 290].map(k => q("C", k, 1, 1.2)), puts: [270, 275, 280, 285, 290].map(k => q("P", k, 1, 1.2)) };
const farC = { calls: [270, 275, 280, 285, 290].map(k => ({ ...q("C", k, 3, 3.2), contract: `IWM261218C${String(k * 1000).padStart(8, "0")}` })), puts: [] };
describe("option strategy presets", () => {
  it("offers 14 presets including calendars, diagonals, straddles, condors and butterflies", () => expect(STRATEGIES).toHaveLength(14));
  it("iron condor is buy/sell puts below and sell/buy calls above", () => {
    const l = buildLegs("iron_condor", near, "2026-11-20", 2, 1)!;
    expect(l.map(x => `${x.side} ${x.type} ${x.strike}`)).toEqual(["buy PUT 270", "sell PUT 275", "sell CALL 285", "buy CALL 290"]);
  });
  it("call butterfly sells 2 of the middle strike", () => expect(buildLegs("call_butterfly", near, "e", 2, 1)!.map(l => l.ratio)).toEqual([1, 2, 1]));
  it("call calendar sells near and buys later at the same strike", () => {
    const l = buildLegs("call_calendar", near, "2026-11-20", 2, 1, farC, "2026-12-18")!;
    expect(l.map(x => [x.side, x.strike, x.expiration])).toEqual([["sell", 280, "2026-11-20"], ["buy", 280, "2026-12-18"]]);
  });
  it("returns null when strikes run off the chain", () => expect(buildLegs("iron_condor", near, "e", 0, 1)).toBeNull());
  it("iron condor 270/275/285/290 for 1.50 credit: profit 150, loss 350, breakevens 273.5 & 286.5", () => {
    expect(payoff(buildLegs("iron_condor", near, "e", 2, 1)!, -1.5)).toEqual({ maxProfit: 150, maxLoss: 350, breakevens: [273.5, 286.5] });
  });
  it("long straddle has unlimited profit and loses the debit", () => {
    const p = payoff(buildLegs("long_straddle", near, "e", 2, 1)!, 4)!;
    expect(p.maxProfit).toBe(Infinity); expect(p.maxLoss).toBe(400); expect(p.breakevens).toEqual([276, 284]);
  });
  it("closing reverses every leg", () => {
    const t = strategyTicket.parse({ symbol: "IWM", action: "close", contracts: 1, limit_price: -1, legs: [{ contract: near.calls[0].contract, side: "buy", ratio: 1 }, { contract: near.calls[1].contract, side: "sell", ratio: 1 }] });
    expect(mlegLegs(t).map(l => l.position_intent)).toEqual(["sell_to_close", "buy_to_close"]);
    expect(closeLegsProblem(t, c => c === near.calls[0].contract ? 1 : 0)).toMatch(/short leg/);
  });
});
