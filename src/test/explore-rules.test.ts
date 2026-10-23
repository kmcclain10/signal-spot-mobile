import { describe, it, expect } from "vitest";
import { filterAssets, rememberSymbol, quoteBarParams, tradeSearch, safeNewsUrl, type Asset } from "@/lib/explore-rules";
describe("Explore rules", () => {
  const assets: Asset[] = [{ symbol: "AAPL", name: "Apple Inc", tradable: true, optionable: true, fractionable: true, shortable: true, exchange: "NASDAQ" }, { symbol: "AAP", name: "Advance Auto", tradable: true, optionable: false, fractionable: true, shortable: false, exchange: "NYSE" }, { symbol: "OLD", name: "Apple old", tradable: false, optionable: false, fractionable: false, shortable: false, exchange: "" }];
  it("searches symbol and name, with exact matches first and untradable assets excluded", () => { expect(filterAssets(assets, "aapl").map(a => a.symbol)).toEqual(["AAPL"]); expect(filterAssets(assets, "apple").map(a => a.symbol)).toEqual(["AAPL"]); expect(filterAssets(assets, "AAP").map(a => a.symbol)).toEqual(["AAP", "AAPL"]); });
  it("remembers the selected symbol without duplicates", () => { expect(rememberSymbol(["IWM", "SPY"], "SPY")).toEqual(["SPY", "IWM"]); });
  it("preserves the selected stock and side in stock and option tickets", () => { expect(tradeSearch.parse({ symbol: "SPY", side: "sell", option: "PUT" })).toEqual({ symbol: "SPY", side: "sell", option: "PUT" }); expect(tradeSearch.safeParse({ symbol: "../secrets" }).success).toBe(false); });
  it("supports the requested 5-year stock history", () => { expect(quoteBarParams("5Y", new Date("2026-10-23T17:14:00Z"))).toMatchObject({ start: "2021-10-23T17:14:00.000Z", timeframe: "1Day", feed: "iex" }); });
  it("only returns secure news links", () => { expect(safeNewsUrl("javascript:alert(1)")).toBeNull(); expect(safeNewsUrl("https://example.com/news")).toBe("https://example.com/news"); });
});