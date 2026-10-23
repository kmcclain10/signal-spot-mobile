import { describe, it, expect } from "vitest";
import { tradeTicket, ticketCost, toBrokerOrder, stockTicket, optionContractParams, orderStatus } from "@/lib/trade-rules";
describe("manual trade rules", () => {
  it("option cost is 100 shares per contract", () => expect(ticketCost(1.25, 3, true)).toBe(375));
  it("limit stock order requires a price", () => expect(tradeTicket.safeParse({kind:"stock",symbol:"IWM",side:"buy",qty:1,type:"limit"}).success).toBe(false));
  it("caps option contracts at 50", () => expect(tradeTicket.safeParse({kind:"option",symbol:"IWM",side:"CALL",contracts:51}).success).toBe(false));
  it.each(["IWM", "SPY", "QQQ", "AAPL", "TSLA", "NVDA"])("keeps the selected %s underlying in an option ticket and contract request", symbol => {
    const t = tradeTicket.parse({kind:"option",symbol,side:"PUT",contracts:1});
    expect(t.symbol).toBe(symbol);
    expect(optionContractParams(t.symbol,"PUT",200,"2026-10-22","2026-11-05").underlying_symbols).toBe(symbol);
  });
  it("requires an underlying for manual options instead of defaulting to IWM", () => {
    expect(tradeTicket.safeParse({kind:"option",side:"CALL",contracts:1}).success).toBe(false);
  });
  it("preserves the IWM bot strike range", () => {
    expect(optionContractParams("IWM","CALL",273,"2026-10-22","2026-11-05")).toMatchObject({strike_price_gte:"270",strike_price_lte:"276"});
  });
  it("builds a day limit order", () => {
    const t = stockTicket.parse({kind:"stock",symbol:"spy",side:"sell",qty:2,type:"limit",limit_price:500.5});
    expect(toBrokerOrder(t,"manual-x")).toMatchObject({symbol:"SPY",qty:"2",limit_price:"500.50",time_in_force:"day"});
  });
});
describe("expanded stock ticket", () => {
  const base = { kind: "stock", symbol: "AAPL", side: "buy" } as const;
  const ok = (t: object) => stockTicket.safeParse({ ...base, ...t }).success;
  it("needs shares or dollars, not both", () => { expect(ok({ type: "market" })).toBe(false); expect(ok({ type: "market", qty: 1, notional: 50 })).toBe(false); });
  it("dollar amounts are market day only, minimum $1", () => { expect(ok({ type: "market", notional: 25 })).toBe(true); expect(ok({ type: "limit", notional: 25, limit_price: 10 })).toBe(false); expect(ok({ type: "market", notional: 25, time_in_force: "gtc" })).toBe(false); expect(ok({ type: "market", notional: 0.5 })).toBe(false); });
  it("stop orders need a stop price", () => { expect(ok({ type: "stop", qty: 1 })).toBe(false); expect(ok({ type: "stop", qty: 1, stop_price: 180 })).toBe(true); });
  it("buy stop-limit limit must be at or above the stop", () => { expect(ok({ type: "stop_limit", qty: 1, stop_price: 180, limit_price: 179 })).toBe(false); expect(ok({ type: "stop_limit", qty: 1, stop_price: 180, limit_price: 181 })).toBe(true); });
  it("extended hours need a limit day order", () => { expect(ok({ type: "market", qty: 1, extended_hours: true })).toBe(false); expect(ok({ type: "limit", qty: 1, limit_price: 10, extended_hours: true, time_in_force: "gtc" })).toBe(false); expect(ok({ type: "limit", qty: 1, limit_price: 10, extended_hours: true })).toBe(true); });
  it("sends notional and stop prices to the broker", () => {
    expect(toBrokerOrder(stockTicket.parse({ ...base, type: "market", notional: 25 }), "m")).toMatchObject({ notional: "25.00", time_in_force: "day" });
    expect(toBrokerOrder(stockTicket.parse({ ...base, type: "stop_limit", qty: 2, stop_price: 180, limit_price: 181, time_in_force: "gtc" }), "m")).toMatchObject({ qty: "2", stop_price: "180.00", limit_price: "181.00", time_in_force: "gtc" });
  });
  it("labels partial fills", () => expect(orderStatus("partially_filled", 3, 10)).toMatchObject({ label: "Partly filled 3/10", done: false }));
});
import { chainTicket, occRoot, optionLimitProblem, closeQtyProblem, chainStrikeRange } from "@/lib/trade-rules";
describe("option chain ticket", () => {
  const t = { symbol: "AAPL", contract: "AAPL261120C00200000", intent: "buy_to_open", contracts: 1, limit_price: 2.5 };
  it("reads the underlying from the contract", () => { expect(occRoot("AAPL261120C00200000")).toBe("AAPL"); expect(occRoot("IWM261023P00250000")).toBe("IWM"); });
  it("rejects a contract from a different stock", () => { expect(chainTicket.safeParse(t).success).toBe(true); expect(chainTicket.safeParse({ ...t, symbol: "IWM" }).success).toBe(false); });
  it("caps contracts at 50 and needs a limit price", () => { expect(chainTicket.safeParse({ ...t, contracts: 51 }).success).toBe(false); expect(chainTicket.safeParse({ ...t, limit_price: 0 }).success).toBe(false); });
  it("only allows buy to open or sell to close", () => expect(chainTicket.safeParse({ ...t, intent: "sell_to_open" }).success).toBe(false));
  it("blocks buys far above the ask", () => { expect(optionLimitProblem("buy_to_open", 2.5, 1.9, 2.0)).toBeNull(); expect(optionLimitProblem("buy_to_open", 2.6, 1.9, 2.0)).toMatch(/above the ask/); expect(optionLimitProblem("buy_to_open", 1, 0, 0)).toMatch(/No live ask/); });
  it("blocks sells far below the bid", () => { expect(optionLimitProblem("sell_to_close", 1.5, 2.0, 2.1)).toBeNull(); expect(optionLimitProblem("sell_to_close", 1.4, 2.0, 2.1)).toMatch(/below the bid/); });
  it("can't sell more than you hold", () => { expect(closeQtyProblem(2, 3)).toMatch(/only 2/); expect(closeQtyProblem(0, 1)).toMatch(/don't hold/); expect(closeQtyProblem(3, 3)).toBeNull(); });
  it("shows strikes within 10% of the price, at least $5", () => { expect(chainStrikeRange(30)).toBe(5); expect(chainStrikeRange(250)).toBe(25); });
});
