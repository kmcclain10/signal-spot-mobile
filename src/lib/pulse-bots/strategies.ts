// strategies.ts — the 10 Pulse Bots strategies.
// Every strategy looks only at CLOSED bars and answers, for the newest bar:
//   entry? (long/short + reason + optional underlying stop/target), exit long?, exit short?, note
// "long" = buy shares or a CALL, "short" = short shares or a PUT (the executor decides by instrument).
// Strategy exits are ignored on the bar a position was opened (executor rule).

import type { Bar } from "./indicators.ts";
import {
  atr, bollinger, crossOver, crossUnder, ema, etParts, highest, hm, lowest, macd, ok, rsi, sma,
  squeeze, supertrend, vwap,
} from "./indicators.ts";
import * as W20 from "./window20Core.ts";

export type RiskLevel = "conservative" | "balanced" | "aggressive" | "test";
export const RISK_INDEX: Record<RiskLevel, number> = { conservative: 0, balanced: 1, aggressive: 2, test: 3 };
export type Timeframe = 1 | 2 | 4 | 5 | 10 | 15 | 30 | 60 | 1440; // minutes; 1440 = daily
export type Dir = "long" | "short";

export interface ParamSpec {
  key: string; label: string; min: number; max: number; step: number;
  presets: [number, number, number, number]; // conservative, balanced, aggressive, test
  help: string;
}
export interface StrategySignal {
  entry?: { side: Dir; reason: string; stop?: number; target?: number };
  exitLong?: string; exitShort?: string;
  note: string; // plain-English status for the "Why no trade?" log
}
export interface EvalCtx {
  entryStart: string; entryEnd: string; // ET "HH:MM", intraday strategies only
  timeframe: Timeframe;
  memo: Set<string>;                    // persisted per bot per day (dedupe)
}
export interface StrategyDef {
  id: StrategyId; botName: string; name: string;
  category: "Trend" | "Breakout" | "Mean reversion" | "Momentum";
  style: "intraday" | "swing"; summary: string; rules: string[];
  timeframes: Timeframe[]; defaultTimeframe: Timeframe; minBars: number;
  params: ParamSpec[];
  evaluate(bars: Bar[], p: Record<string, number>, ctx: EvalCtx): StrategySignal;
}
export type StrategyId =
  | "window20" | "orb" | "vwap_reclaim" | "ema_pullback" | "ttm_squeeze"
  | "rsi2" | "macd_cross" | "band_bounce" | "supertrend" | "donchian";

const P = (key: string, label: string, min: number, max: number, step: number,
  presets: [number, number, number, number], help: string): ParamSpec => ({ key, label, min, max, step, presets, help });

const closes = (b: Bar[]) => b.map((x) => x.c);
const inEntryWindow = (b: Bar, ctx: EvalCtx, style: string) => {
  if (style === "swing" || ctx.timeframe === 1440) return true;
  const m = etParts(b.t).minutes; return m >= hm(ctx.entryStart) && m < hm(ctx.entryEnd);
};
const wait = (note: string): StrategySignal => ({ note });

// ------------------------------------------------------------------ 1
const window20: StrategyDef = {
  id: "window20", botName: "Window 20", name: "20-Minute Window (8/20 EMA + two-pole dot)",
  category: "Momentum", style: "intraday",
  summary: "Your original setup: an 8/20 EMA cross and a matching oscillator dot inside one 20-minute window, entered on the Nth candle.",
  rules: ["8 EMA above 20 EMA (calls) or below (puts)", "8/20 cross inside the current 20-minute window (10:00–3:00 ET)",
    "Matching two-pole oscillator dot (length 15)", "Enter on exactly the Nth consecutive candle after the cross, never the window's last bar",
    "Strategy exit: candle closes on the wrong side of the 8 EMA"],
  timeframes: [1, 2, 4, 5, 10], defaultTimeframe: 2, minBars: 60,
  params: [
    P("entryCandle", "Entry candle #", 1, 5, 1, [3, 3, 2, 1], "Which consecutive candle after the cross triggers entry"),
    P("requireDot", "Require oscillator dot (1=yes)", 0, 1, 1, [1, 1, 1, 0], "Turn off to trade the EMA cross alone"),
    P("dotLookbackBars", "Dot lookback (bars, 0=same window)", 0, 30, 1, [0, 0, 10, 0], "How far back the dot may be"),
    P("emaFast", "Fast EMA", 3, 20, 1, [8, 8, 8, 8], ""), P("emaSlow", "Slow EMA", 10, 50, 1, [20, 20, 20, 20], ""),
    P("oscLength", "Oscillator length", 5, 40, 1, [15, 15, 15, 15], ""),
  ],
  evaluate(b, p, ctx) {
    const cfg = { ...W20.DEFAULT_CONFIG, timeframeMin: ctx.timeframe, emaFast: p.emaFast, emaSlow: p.emaSlow,
      oscLength: p.oscLength, entryCandle: p.entryCandle, requireDot: p.requireDot === 1, dotLookbackBars: p.dotLookbackBars };
    const rows = W20.addIndicators(b, cfg); const last = rows[rows.length - 1];
    const out: StrategySignal = { note: "No 8/20 setup in this window",
      exitLong: last.c < last.emaFast ? "Closed below 8 EMA" : undefined,
      exitShort: last.c > last.emaFast ? "Closed above 8 EMA" : undefined };
    for (const s of W20.evaluate(rows, ctx.memo, cfg)) {
      if (s.kind === "potential") out.note = `Setup forming (${s.side === "CALL" ? "long" : "short"}): ${s.detail}`;
      if (s.kind === "entry") out.entry = { side: s.side === "CALL" ? "long" : "short", reason: `Window ${s.window}: ${s.detail}` };
    }
    return out;
  },
};

// ------------------------------------------------------------------ 2
const orb: StrategyDef = {
  id: "orb", botName: "Opening Bell", name: "Opening Range Breakout", category: "Breakout", style: "intraday",
  summary: "Marks the high and low of the first minutes after the open and trades the first close beyond them.",
  rules: ["Opening range = high/low of the first N minutes from 9:30 ET", "Long on the first close above the range high (short: below the low)",
    "Underlying stop at the opposite side of the range; target = R multiple of that risk", "One trade per side per day, no entries after the cutoff"],
  timeframes: [1, 2, 5, 15], defaultTimeframe: 5, minBars: 10,
  params: [
    P("orMinutes", "Opening range (minutes)", 5, 60, 5, [30, 15, 5, 5], "Length of the opening range"),
    P("rMultiple", "Target (R multiple)", 0.5, 10, 0.5, [1.5, 2, 3, 2], "Target distance as a multiple of the stop distance"),
    P("cutoffMinutes", "No entries after (minutes from open)", 30, 330, 15, [90, 120, 180, 300], ""),
  ],
  evaluate(b, p, ctx) {
    const last = b[b.length - 1]; const { date, minutes } = etParts(last.t); const open = 570;
    const today = b.filter((x) => etParts(x.t).date === date);
    const orBars = today.filter((x) => { const m = etParts(x.t).minutes; return m >= open && m < open + Math.max(p.orMinutes, ctx.timeframe); });
    if (!orBars.length || minutes < open + p.orMinutes) return wait("Building the opening range");
    if (minutes >= open + p.cutoffMinutes) return wait("Past the entry cutoff");
    const hi = Math.max(...orBars.map((x) => x.h)), lo = Math.min(...orBars.map((x) => x.l));
    const prev = b[b.length - 2];
    if (last.c > hi && prev.c <= hi && !ctx.memo.has(`${date}|orb|long`)) {
      ctx.memo.add(`${date}|orb|long`); const risk = last.c - lo;
      return { entry: { side: "long", reason: `Closed above opening range high ${hi.toFixed(2)}`, stop: lo, target: last.c + p.rMultiple * risk },
        note: "Breakout up" };
    }
    if (last.c < lo && prev.c >= lo && !ctx.memo.has(`${date}|orb|short`)) {
      ctx.memo.add(`${date}|orb|short`); const risk = hi - last.c;
      return { entry: { side: "short", reason: `Closed below opening range low ${lo.toFixed(2)}`, stop: hi, target: last.c - p.rMultiple * risk },
        note: "Breakout down" };
    }
    return wait(`Range ${lo.toFixed(2)}–${hi.toFixed(2)}, waiting for a close outside it`);
  },
};

// ------------------------------------------------------------------ 3
const vwapReclaim: StrategyDef = {
  id: "vwap_reclaim", botName: "VWAP Reclaim", name: "VWAP Reclaim / Rejection", category: "Momentum", style: "intraday",
  summary: "Buys when price closes back above VWAP after trading below it (short: loses VWAP after holding above).",
  rules: ["Price spent at least N bars below VWAP today", "Bar closes back above VWAP", "Optional: 9 EMA above VWAP and above-average volume",
    "Strategy exit: close back below VWAP"],
  timeframes: [1, 2, 5, 15], defaultTimeframe: 5, minBars: 25,
  params: [
    P("minBelowBars", "Bars on the other side first", 1, 20, 1, [5, 3, 2, 1], "How long price must stay below VWAP before a reclaim counts"),
    P("requireEma", "Require 9 EMA confirm (1=yes)", 0, 1, 1, [1, 1, 0, 0], ""),
    P("requireVolume", "Require above-average volume (1=yes)", 0, 1, 1, [1, 0, 0, 0], "Volume above its 20-bar average"),
    P("emaLen", "EMA length", 5, 21, 1, [9, 9, 9, 9], ""),
  ],
  evaluate(b, p, ctx) {
    const i = b.length - 1, last = b[i]; if (!inEntryWindow(last, ctx, this.style)) return wait("Outside entry hours");
    const vw = vwap(b), e = ema(closes(b), p.emaLen), vAvg = sma(b.map((x) => x.v ?? 0), 20);
    const date = etParts(last.t).date; const n = p.minBelowBars;
    const prior = b.slice(i - n, i); const sameDay = prior.length === n && prior.every((x) => etParts(x.t).date === date);
    const volOk = p.requireVolume !== 1 || (last.v ?? 0) > vAvg[i];
    const out: StrategySignal = { note: last.c > vw[i] ? "Above VWAP" : "Below VWAP",
      exitLong: last.c < vw[i] ? "Closed below VWAP" : undefined, exitShort: last.c > vw[i] ? "Closed above VWAP" : undefined };
    if (sameDay && volOk && last.c > vw[i] && prior.every((x, k) => x.c < vw[i - n + k]) && (p.requireEma !== 1 || e[i] > vw[i]))
      out.entry = { side: "long", reason: `Reclaimed VWAP ${vw[i].toFixed(2)} after ${n} bars below` };
    else if (sameDay && volOk && last.c < vw[i] && prior.every((x, k) => x.c > vw[i - n + k]) && (p.requireEma !== 1 || e[i] < vw[i]))
      out.entry = { side: "short", reason: `Lost VWAP ${vw[i].toFixed(2)} after ${n} bars above` };
    return out;
  },
};

// ------------------------------------------------------------------ 4
const emaPullback: StrategyDef = {
  id: "ema_pullback", botName: "Trend Rider", name: "EMA Trend Pullback (9/21/50)", category: "Trend", style: "intraday",
  summary: "In a stacked uptrend, waits for a pullback to the 21 EMA and enters when price closes back above the 9 EMA.",
  rules: ["Trend: 9 EMA > 21 EMA > 50 EMA (short: reversed)", "Pullback: a recent low touched the 21 EMA",
    "Entry: close crosses back above the 9 EMA", "Strategy exit: close below the 21 EMA"],
  timeframes: [1, 2, 5, 15, 30, 60, 1440], defaultTimeframe: 5, minBars: 60,
  params: [
    P("fast", "Fast EMA", 5, 20, 1, [9, 9, 9, 9], ""), P("mid", "Middle EMA", 10, 50, 1, [21, 21, 21, 21], ""),
    P("slow", "Slow EMA", 30, 200, 5, [50, 50, 50, 50], ""),
    P("pullbackBars", "Pullback lookback (bars)", 2, 20, 1, [5, 6, 8, 10], ""),
    P("touchTolPct", "Touch tolerance (%)", 0, 1, 0.05, [0, 0.05, 0.1, 0.25], "How close to the 21 EMA counts as a touch"),
  ],
  evaluate(b, p, ctx) {
    const i = b.length - 1; const c = closes(b);
    const f = ema(c, p.fast), m = ema(c, p.mid), s = ema(c, p.slow); const last = b[i];
    const out: StrategySignal = { note: f[i] > m[i] && m[i] > s[i] ? "Uptrend, waiting for pullback" : f[i] < m[i] && m[i] < s[i] ? "Downtrend, waiting for pullback" : "No stacked trend",
      exitLong: last.c < m[i] ? "Closed below 21 EMA" : undefined, exitShort: last.c > m[i] ? "Closed above 21 EMA" : undefined };
    if (!inEntryWindow(last, ctx, this.style)) return { ...out, note: "Outside entry hours" };
    const tol = p.touchTolPct / 100; const lb = Math.max(1, i - p.pullbackBars);
    let touchUp = false, touchDn = false;
    for (let k = lb; k <= i; k++) { if (b[k].l <= m[k] * (1 + tol)) touchUp = true; if (b[k].h >= m[k] * (1 - tol)) touchDn = true; }
    if (f[i] > m[i] && m[i] > s[i] && touchUp && crossOver(c, f, i)) out.entry = { side: "long", reason: "Pullback to 21 EMA, closed back above 9 EMA" };
    else if (f[i] < m[i] && m[i] < s[i] && touchDn && crossUnder(c, f, i)) out.entry = { side: "short", reason: "Bounce to 21 EMA, closed back below 9 EMA" };
    return out;
  },
};

// ------------------------------------------------------------------ 5
const ttm: StrategyDef = {
  id: "ttm_squeeze", botName: "Squeeze Fire", name: "TTM Squeeze", category: "Breakout", style: "intraday",
  summary: "Waits for volatility to compress (Bollinger Bands inside Keltner Channels), then trades the direction of momentum when it releases.",
  rules: ["Squeeze on: Bollinger Bands (20, 2) inside Keltner Channels (20, 1.5) for at least N bars", "Squeeze fires: bands expand back outside",
    "Long if momentum is above zero and rising (short: below zero and falling)", "Strategy exit: momentum fades for N bars in a row"],
  timeframes: [5, 15, 30, 60, 1440], defaultTimeframe: 15, minBars: 45,
  params: [
    P("minSqueezeBars", "Minimum squeeze length (bars)", 1, 20, 1, [6, 4, 2, 1], ""),
    P("kcMult", "Keltner multiplier", 1, 2.5, 0.1, [1.5, 1.5, 2, 2], "1.5 = classic squeeze; 2.0 also counts low-compression squeezes (Squeeze Pro)"),
    P("fadeBars", "Exit after momentum fades (bars)", 1, 5, 1, [2, 2, 3, 3], ""),
  ],
  evaluate(b, p, ctx) {
    const i = b.length - 1; const { on, mom } = squeeze(b, 20, 2, p.kcMult);
    let run = 0; for (let k = i - 1; k >= 0 && on[k]; k--) run++;
    const fading = (dir: 1 | -1) => { for (let k = 0; k < p.fadeBars; k++) { const a = mom[i - k], z = mom[i - k - 1]; if (!ok(a, z) || (dir === 1 ? a >= z : a <= z)) return false; } return true; };
    const out: StrategySignal = { note: on[i] ? `Squeeze on (${run + 1} bars)` : "No squeeze",
      exitLong: fading(1) ? "Momentum fading" : undefined, exitShort: fading(-1) ? "Momentum fading" : undefined };
    if (!inEntryWindow(b[i], ctx, this.style)) return { ...out, note: "Outside entry hours" };
    if (on[i - 1] && !on[i] && run >= p.minSqueezeBars && ok(mom[i], mom[i - 1])) {
      if (mom[i] > 0 && mom[i] > mom[i - 1]) out.entry = { side: "long", reason: `Squeeze fired after ${run} bars, momentum up` };
      else if (mom[i] < 0 && mom[i] < mom[i - 1]) out.entry = { side: "short", reason: `Squeeze fired after ${run} bars, momentum down` };
    }
    return out;
  },
};

// ------------------------------------------------------------------ 6
const rsi2: StrategyDef = {
  id: "rsi2", botName: "Dip Buyer", name: "RSI(2) Mean Reversion (Connors)", category: "Mean reversion", style: "swing",
  summary: "Buys short, sharp dips in a long-term uptrend and sells the bounce (short: pops in a downtrend).",
  rules: ["Trend: close above the 200-bar SMA (short: below)", "Entry: RSI(2) drops below the threshold and close is under the 5-bar SMA",
    "Strategy exit: close back above the 5-bar SMA (short: below)"],
  timeframes: [15, 30, 60, 1440], defaultTimeframe: 1440, minBars: 210,
  params: [
    P("entryRsi", "RSI(2) entry threshold", 1, 30, 1, [5, 10, 15, 20], "Lower = deeper dips only"),
    P("trendLen", "Trend SMA length", 50, 200, 10, [200, 200, 200, 100], ""),
    P("exitLen", "Exit SMA length", 3, 10, 1, [5, 5, 5, 5], ""),
  ],
  evaluate(b, p) {
    const i = b.length - 1; const c = closes(b); const r = rsi(c, 2), t = sma(c, p.trendLen), x = sma(c, p.exitLen);
    if (!ok(r[i], r[i - 1], t[i], x[i])) return wait("Warming up (needs more history)");
    const out: StrategySignal = { note: `RSI(2) ${r[i].toFixed(0)}, ${c[i] > t[i] ? "above" : "below"} trend SMA`,
      exitLong: c[i] > x[i] ? `Closed above ${p.exitLen} SMA` : undefined, exitShort: c[i] < x[i] ? `Closed below ${p.exitLen} SMA` : undefined };
    if (c[i] > t[i] && c[i] < x[i] && r[i] < p.entryRsi && r[i - 1] >= p.entryRsi) out.entry = { side: "long", reason: `RSI(2) ${r[i].toFixed(1)} dip in uptrend` };
    else if (c[i] < t[i] && c[i] > x[i] && r[i] > 100 - p.entryRsi && r[i - 1] <= 100 - p.entryRsi) out.entry = { side: "short", reason: `RSI(2) ${r[i].toFixed(1)} pop in downtrend` };
    return out;
  },
};

// ------------------------------------------------------------------ 7
const macdCross: StrategyDef = {
  id: "macd_cross", botName: "Momentum Cross", name: "MACD Signal Cross with Trend Filter", category: "Momentum", style: "intraday",
  summary: "Trades MACD crossing its signal line, only in the direction of the longer trend.",
  rules: ["MACD (12, 26, 9) crosses above its signal line (short: below)", "Price above the trend EMA (short: below)",
    "Conservative: cross must happen below the zero line (above for shorts)", "Strategy exit: MACD crosses back"],
  timeframes: [5, 15, 30, 60, 1440], defaultTimeframe: 15, minBars: 60,
  params: [
    P("trendLen", "Trend EMA length", 20, 200, 10, [200, 200, 100, 50], ""),
    P("requireZeroSide", "Cross must be on the far side of zero (1=yes)", 0, 1, 1, [1, 0, 0, 0], ""),
  ],
  evaluate(b, p, ctx) {
    const i = b.length - 1; const c = closes(b); const m = macd(c); const t = ema(c, p.trendLen);
    const out: StrategySignal = { note: m.line[i] > m.signal[i] ? "MACD above signal" : "MACD below signal",
      exitLong: crossUnder(m.line, m.signal, i) ? "MACD crossed below signal" : undefined,
      exitShort: crossOver(m.line, m.signal, i) ? "MACD crossed above signal" : undefined };
    if (!inEntryWindow(b[i], ctx, this.style)) return { ...out, note: "Outside entry hours" };
    if (crossOver(m.line, m.signal, i) && c[i] > t[i] && (p.requireZeroSide !== 1 || m.line[i] < 0)) out.entry = { side: "long", reason: "MACD bullish cross in uptrend" };
    else if (crossUnder(m.line, m.signal, i) && c[i] < t[i] && (p.requireZeroSide !== 1 || m.line[i] > 0)) out.entry = { side: "short", reason: "MACD bearish cross in downtrend" };
    return out;
  },
};

// ------------------------------------------------------------------ 8
const bandBounce: StrategyDef = {
  id: "band_bounce", botName: "Band Bounce", name: "Bollinger Band Mean Reversion", category: "Mean reversion", style: "intraday",
  summary: "Buys when price closes back inside the lower Bollinger Band from an oversold reading and targets the middle band.",
  rules: ["Previous bar closed below the lower band (short: above the upper band)", "This bar closes back inside the band",
    "RSI(14) was oversold (short: overbought)", "Strategy exit: price reaches the middle band"],
  timeframes: [5, 15, 30, 60, 1440], defaultTimeframe: 15, minBars: 40,
  params: [
    P("bbMult", "Band width (std devs)", 1.5, 3, 0.1, [2.2, 2, 2, 1.5], "Wider = rarer, deeper extremes"),
    P("rsiMax", "RSI(14) oversold level", 15, 50, 1, [30, 35, 40, 50], "Short side uses 100 minus this"),
    P("trendFilter", "Only trade with the 200-bar trend (1=yes)", 0, 1, 1, [1, 0, 0, 0], ""),
  ],
  evaluate(b, p, ctx) {
    const i = b.length - 1; const c = closes(b); const bb = bollinger(c, 20, p.bbMult); const r = rsi(c, 14); const t = sma(c, 200);
    const out: StrategySignal = { note: "Inside the bands",
      exitLong: c[i] >= bb.mid[i] ? "Reached middle band" : undefined, exitShort: c[i] <= bb.mid[i] ? "Reached middle band" : undefined };
    if (!inEntryWindow(b[i], ctx, this.style)) return { ...out, note: "Outside entry hours" };
    const trendUp = p.trendFilter !== 1 || c[i] > t[i], trendDn = p.trendFilter !== 1 || c[i] < t[i];
    if (c[i - 1] < bb.lower[i - 1] && c[i] > bb.lower[i] && r[i - 1] < p.rsiMax && trendUp) out.entry = { side: "long", reason: `Back inside lower band, RSI ${r[i - 1].toFixed(0)}` };
    else if (c[i - 1] > bb.upper[i - 1] && c[i] < bb.upper[i] && r[i - 1] > 100 - p.rsiMax && trendDn) out.entry = { side: "short", reason: `Back inside upper band, RSI ${r[i - 1].toFixed(0)}` };
    return out;
  },
};

// ------------------------------------------------------------------ 9
const superTrendDef: StrategyDef = {
  id: "supertrend", botName: "Trend Flip", name: "Supertrend Flip", category: "Trend", style: "intraday",
  summary: "Follows the Supertrend line: long when it flips up, out (or short) when it flips down.",
  rules: ["Supertrend (ATR 10 × multiplier) flips from down to up (short: up to down)", "Conservative: price must also be above the 200 EMA (short: below)",
    "Strategy exit: Supertrend flips the other way"],
  timeframes: [5, 15, 30, 60, 1440], defaultTimeframe: 15, minBars: 30,
  params: [
    P("atrLen", "ATR length", 5, 30, 1, [10, 10, 10, 10], ""),
    P("mult", "ATR multiplier", 1, 5, 0.1, [3.5, 3, 2.5, 2], "Lower = faster flips, more trades"),
    P("trendFilter", "Only trade with the 200 EMA (1=yes)", 0, 1, 1, [1, 0, 0, 0], ""),
  ],
  evaluate(b, p, ctx) {
    const i = b.length - 1; const st = supertrend(b, p.atrLen, p.mult); const t = ema(closes(b), 200);
    const up = st.dir[i] === 1 && st.dir[i - 1] === -1, dn = st.dir[i] === -1 && st.dir[i - 1] === 1;
    const out: StrategySignal = { note: st.dir[i] === 1 ? "Supertrend up" : "Supertrend down",
      exitLong: st.dir[i] === -1 ? "Supertrend is down" : undefined, exitShort: st.dir[i] === 1 ? "Supertrend is up" : undefined };
    if (!inEntryWindow(b[i], ctx, this.style)) return { ...out, note: "Outside entry hours" };
    if (up && (p.trendFilter !== 1 || b[i].c > t[i])) out.entry = { side: "long", reason: "Supertrend flipped up", stop: st.line[i] };
    else if (dn && (p.trendFilter !== 1 || b[i].c < t[i])) out.entry = { side: "short", reason: "Supertrend flipped down", stop: st.line[i] };
    return out;
  },
};

// ------------------------------------------------------------------ 10
const donchian: StrategyDef = {
  id: "donchian", botName: "Breakout 20", name: "Donchian Channel Breakout (Turtle)", category: "Breakout", style: "swing",
  summary: "Buys a close above the highest high of the last N bars and exits on a close below the lowest low of a shorter lookback.",
  rules: ["Long: close above the highest high of the previous N bars (short: below the lowest low)",
    "Strategy exit: close below the lowest low of the previous M bars (short: above the highest high)"],
  timeframes: [15, 30, 60, 1440], defaultTimeframe: 1440, minBars: 60,
  params: [
    P("entryLen", "Breakout lookback (bars)", 5, 100, 1, [55, 20, 15, 10], ""),
    P("exitLen", "Exit lookback (bars)", 3, 50, 1, [20, 10, 8, 5], ""),
  ],
  evaluate(b, p) {
    const i = b.length - 1; const h = b.map((x) => x.h), l = b.map((x) => x.l);
    const hh = highest(h, p.entryLen), ll = lowest(l, p.entryLen), xl = lowest(l, p.exitLen), xh = highest(h, p.exitLen);
    if (!ok(hh[i - 1], ll[i - 1], hh[i - 2])) return wait("Warming up (needs more history)");
    const c = b[i].c, pc = b[i - 1].c;
    const out: StrategySignal = { note: `Channel ${ll[i - 1].toFixed(2)}–${hh[i - 1].toFixed(2)}`,
      exitLong: c < xl[i - 1] ? `Closed below ${p.exitLen}-bar low` : undefined, exitShort: c > xh[i - 1] ? `Closed above ${p.exitLen}-bar high` : undefined };
    if (c > hh[i - 1] && pc <= hh[i - 2]) out.entry = { side: "long", reason: `New ${p.entryLen}-bar high`, stop: xl[i - 1] };
    else if (c < ll[i - 1] && pc >= ll[i - 2]) out.entry = { side: "short", reason: `New ${p.entryLen}-bar low`, stop: xh[i - 1] };
    return out;
  },
};

export const STRATEGIES: StrategyDef[] = [window20, orb, vwapReclaim, emaPullback, ttm, rsi2, macdCross, bandBounce, superTrendDef, donchian];
export const getStrategy = (id: StrategyId) => {
  const s = STRATEGIES.find((x) => x.id === id); if (!s) throw new Error(`unknown strategy ${id}`); return s;
};
void atr;
