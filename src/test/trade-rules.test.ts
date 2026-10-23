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
