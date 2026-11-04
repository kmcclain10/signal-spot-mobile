import { describe, expect, it } from "vitest";
import { PLANS, canRunBots, priceIdFor, tierFromPriceId } from "@/lib/plans";

describe("subscription plans", () => {
  it("prices Alerts Only at $49/mo and $490/yr", () => {
    expect(PLANS.alerts.monthly).toBe(49);
    expect(PLANS.alerts.yearly).toBe(490);
  });
  it("prices Full AI Bots at $99/mo and $990/yr", () => {
    expect(PLANS.bots.monthly).toBe(99);
    expect(PLANS.bots.yearly).toBe(990);
  });
  it("only the bots plan can run bots", () => {
    expect(canRunBots(tierFromPriceId("alerts_yearly"))).toBe(false);
    expect(canRunBots(tierFromPriceId("bots_monthly"))).toBe(true);
    expect(canRunBots(null)).toBe(false);
  });
  it("builds checkout price ids", () => {
    expect(priceIdFor("bots", "yearly")).toBe("bots_yearly");
  });
});
