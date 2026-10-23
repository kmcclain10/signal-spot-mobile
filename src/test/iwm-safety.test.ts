import { describe, it, expect } from "vitest";
import { freshQuote, sessionEndMinutes, entryBlock, positionMismatch } from "@/lib/iwm-engine-rules";

const now = new Date("2026-10-16T15:00:00Z");
describe("IWM safety rules", () => {
  it("ignores quotes older than 15 seconds", () => {
    expect(freshQuote({ bp: 1, ap: 1.1, t: "2026-10-16T14:59:50Z" }, now)).toBe(true);
    expect(freshQuote({ bp: 1, ap: 1.1, t: "2026-10-16T14:59:40Z" }, now)).toBe(false);
  });
  it("ignores zero bid, zero ask and crossed quotes", () => {
    expect(freshQuote({ bp: 0, ap: 1, t: now.toISOString() }, now)).toBe(false);
    expect(freshQuote({ bp: 1, ap: 0, t: now.toISOString() }, now)).toBe(false);
    expect(freshQuote({ bp: 1.2, ap: 1.1, t: now.toISOString() }, now)).toBe(false);
  });
  it("ends entries at 3:00 PM, or 12:00 PM on a 1:00 PM early close", () => {
    expect(sessionEndMinutes(960)).toBe(900);
    expect(sessionEndMinutes(780)).toBe(720);
  });
  it("blocks entries for kill switch, needs review, and the daily loss limit", () => {
    expect(entryBlock({ kill_switch: true }, {})).toBe("kill switch");
    expect(entryBlock({}, { needs_review: "x" })).toBe("needs review");
    expect(entryBlock({ max_daily_loss: 100 }, { pnl_today: -100 })).toBe("daily loss limit");
    expect(entryBlock({ max_daily_loss: 100 }, { pnl_today: -99.99 })).toBeNull();
  });
  it("detects a missing bot position and an unknown broker position", () => {
    const open = { open_trade: { optionSymbol: "IWM261016C00273000" }, pending_order: null };
    expect(positionMismatch(open, [])).toEqual({ kind: "missing", symbol: "IWM261016C00273000" });
    expect(positionMismatch({ open_trade: null }, [{ symbol: "IWM261016P00270000", asset_class: "us_option" }])?.kind).toBe("orphan");
    expect(positionMismatch(open, [{ symbol: "IWM261016C00273000", asset_class: "us_option" }])).toBeNull();
    expect(positionMismatch({ open_trade: null }, [{ symbol: "IWM", asset_class: "us_equity" }])).toBeNull();
  });
});
