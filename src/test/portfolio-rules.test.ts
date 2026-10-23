import { describe, it, expect } from "vitest";
import { historyParams, equityPoints, watchlistInput, moveWatchSymbol, portfolioRefreshInterval } from "@/lib/portfolio-rules";
describe("Home portfolio rules", () => {
  const now = new Date("2026-10-23T17:02:00Z");
  it("supports all seven requested history periods", () => {
    for (const range of ["1D", "1W", "1M", "3M", "1Y"] as const) expect(historyParams(range, now).period).toBe(range);
    expect(historyParams("YTD", now)).toMatchObject({ start: "2026-01-01T00:00:00Z", end: now.toISOString(), timeframe: "1D" });
    expect(historyParams("ALL", now, "2026-01-03T10:00:00Z").start).toBe("2026-01-03T10:00:00.000Z");
  });
  it("refreshes every five seconds only in the foreground", () => { expect(portfolioRefreshInterval(true)).toBe(5000); expect(portfolioRefreshInterval(false)).toBe(false); });
  it("preserves actual zero equity and skips missing data instead of inventing chart values", () => { expect(equityPoints({ timestamp: [1, 2, 3], equity: [0, null, 100] })).toEqual([{ timestamp: 1, equity: 0, pnl: null, pct: null }, { timestamp: 3, equity: 100, pnl: null, pct: null }]); });
  it("keeps watchlists unique and within the existing 50-symbol limit", () => { expect(watchlistInput.safeParse(["IWM", "IWM"]).success).toBe(false); expect(watchlistInput.safeParse(Array(51).fill("SPY")).success).toBe(false); expect(watchlistInput.parse(["spy", "IWM"])).toEqual(["SPY", "IWM"]); });
  it("reorders without adding or dropping symbols", () => { expect(moveWatchSymbol(["IWM", "SPY", "AAPL"], 1, -1)).toEqual(["SPY", "IWM", "AAPL"]); expect(moveWatchSymbol(["IWM", "SPY"], 0, -1)).toEqual(["IWM", "SPY"]); });
});