import { describe, it, expect } from "vitest";
import { STRATEGIES } from "@/lib/pulse-bots/strategies";
const tf = (id: string) => (STRATEGIES as any[]).find((s) => s.id === id)?.defaultTimeframe;
describe("alert timeframes", () => {
  it("slower strategies default to 15-minute charts", () => {
    for (const id of ["ema_pullback", "supertrend", "macd_cross", "ttm_squeeze", "band_bounce"]) expect(tf(id)).toBe(15);
  });
  it("ORB and Scalpers stay on 5-minute charts", () => {
    expect(tf("orb")).toBe(5); expect(tf("scalpers")).toBe(5);
  });
});
