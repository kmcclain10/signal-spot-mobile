import { describe, it, expect } from "vitest";
import { getStrategy } from "@/lib/pulse-bots";
import { defaultPulseConfig, pulseConfigSchema } from "@/lib/pulse-bots/config";

const s = getStrategy("scalpers");
const p = { emaLen: 9, rMultiple: 2, stopBuffer: 0.02, minStopPct: 0.1, maxStopPct: 0.4 };
const ctx = (entryStart = "09:45") => ({ entryStart, entryEnd: "15:30", timeframe: 5 as const, memo: new Set<string>() });
// 5-min bars on 2026-11-09 starting 9:30 ET (14:30Z); price drifts down then pops up
function bars(lastClose: number, lastLow: number) {
  const out = [] as { t: string; o: number; h: number; l: number; c: number; v: number }[];
  for (let k = 0; k < 12; k++) {
    const c = 200 - k * 0.05; const t = new Date(Date.UTC(2026, 10, 9, 14, 30 + k * 5)).toISOString();
    out.push({ t, o: c, h: c + 0.05, l: c - 0.05, c, v: 1000 });
  }
  out.push({ t: new Date(Date.UTC(2026, 10, 9, 15, 30)).toISOString(), o: 199.5, h: lastClose + 0.05, l: lastLow, c: lastClose, v: 50000 });
  return out;
}

describe("The Scalpers", () => {
  it("goes long on 9 EMA crossing above VWAP with stop under candle and 2R target", () => {
    const r = s.evaluate(bars(200.6, 199.9), p, ctx());
    expect(r.entry?.side).toBe("long");
    expect(r.entry?.stop).toBe(199.88);
    expect(r.entry?.target).toBeCloseTo(200.6 + 2 * (200.6 - 199.88), 1);
  });
  it("skips when the stop is wider than 0.40%", () => {
    const r = s.evaluate(bars(200.6, 199.0), p, ctx());
    expect(r.entry).toBeUndefined();
  });
  it("no entries before 9:45 ET", () => {
    const r = s.evaluate(bars(200.6, 199.9), p, ctx("10:45"));
    expect(r.entry).toBeUndefined();
  });
  it("defaults to IWM 0DTE options, both directions, 3 trades a day", () => {
    const c = defaultPulseConfig("scalpers");
    expect(c.symbols).toEqual(["IWM"]);
    expect(c.instrument).toBe("options");
    expect(c.direction).toBe("both");
    expect(c.overrides?.maxTradesPerDay).toBe(3);
    expect(pulseConfigSchema.safeParse(c).success).toBe(true);
  });
});
