import { describe, it, expect } from "vitest";
import { tradeTicket, ticketCost, toBrokerOrder, stockTicket } from "@/lib/trade-rules";
describe("manual trade rules", () => {
  it("option cost is 100 shares per contract", () => expect(ticketCost(1.25, 3, true)).toBe(375));
  it("limit stock order requires a price", () => expect(tradeTicket.safeParse({kind:"stock",symbol:"IWM",side:"buy",qty:1,type:"limit"}).success).toBe(false));
  it("caps option contracts at 50", () => expect(tradeTicket.safeParse({kind:"iwm_option",side:"CALL",contracts:51}).success).toBe(false));
  it("builds a day limit order", () => {
    const t = stockTicket.parse({kind:"stock",symbol:"spy",side:"sell",qty:2,type:"limit",limit_price:500.5});
    expect(toBrokerOrder(t,"manual-x")).toMatchObject({symbol:"SPY",qty:"2",limit_price:"500.50",time_in_force:"day"});
  });
});
