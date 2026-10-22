import { describe, it, expect } from "vitest";
import { tradeTicket, ticketCost, toBrokerOrder, stockTicket, optionContractParams } from "@/lib/trade-rules";
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
