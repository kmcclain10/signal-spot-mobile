import { describe, it, expect } from "vitest";
import { spreadMath, spreadTicket } from "@/lib/trade-rules";
describe("vertical spreads", () => {
  it("bull call debit 280/285 for 2.00", () => expect(spreadMath("CALL", 280, 285, 2)).toMatchObject({ maxProfit: 300, maxLoss: 200, breakeven: 282 }));
  it("bull put credit sell 280 buy 275 for 1.50", () => expect(spreadMath("PUT", 275, 280, -1.5)).toMatchObject({ maxProfit: 150, maxLoss: 350, breakeven: 278.5 }));
  it("rejects same strike for both legs", () => expect(spreadTicket.safeParse({ symbol: "IWM", long_contract: "IWM261111C00280000", short_contract: "IWM261111C00280000", action: "open", contracts: 1, limit_price: 1 }).success).toBe(false));
});
