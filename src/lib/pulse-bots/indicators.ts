// indicators.ts — shared technical indicators for Pulse Bots.
// Pure functions over arrays; NaN until enough data. Formulas follow TradingView
// (Pine) conventions so values line up with what you see on a TradingView chart.

export interface Bar { t: string; o: number; h: number; l: number; c: number; v?: number } // t = bar START time, ISO

// ---------- time (America/New_York) ----------
const etFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York", hourCycle: "h23",
  year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
});
const etCache = new Map<string, { date: string; minutes: number }>();
export function etParts(iso: string): { date: string; minutes: number } {
  let v = etCache.get(iso);
  if (!v) {
    const p = Object.fromEntries(etFmt.formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
    v = { date: `${p.year}-${p.month}-${p.day}`, minutes: Number(p.hour) * 60 + Number(p.minute) };
    if (etCache.size > 50000) etCache.clear();
    etCache.set(iso, v);
  }
  return v;
}
export const hm = (s: string) => { const [h, m] = s.split(":").map(Number); return h * 60 + m; };

// ---------- moving averages ----------
export function sma(x: number[], n: number): number[] {
  const out = new Array(x.length).fill(NaN); let s = 0, bad = 0;
  for (let i = 0; i < x.length; i++) {
    if (Number.isNaN(x[i])) bad++; else s += x[i];
    if (i >= n) { if (Number.isNaN(x[i - n])) bad--; else s -= x[i - n]; }
    if (i >= n - 1 && bad === 0) out[i] = s / n;
  }
  return out;
}
/** Pine ta.ema: seeded with the first value. */
export function ema(x: number[], n: number): number[] {
  const a = 2 / (n + 1); const out: number[] = []; let prev = NaN;
  for (const v of x) {
    prev = Number.isNaN(v) ? prev : Number.isNaN(prev) ? v : a * v + (1 - a) * prev;
    out.push(prev);
  }
  return out;
}
/** Pine ta.rma (Wilder): seeded with the SMA of the first n values. */
export function rma(x: number[], n: number): number[] {
  const out = new Array(x.length).fill(NaN); let prev = NaN, cnt = 0, s = 0;
  for (let i = 0; i < x.length; i++) {
    const v = x[i]; if (Number.isNaN(v)) continue;
    if (Number.isNaN(prev)) { s += v; cnt++; if (cnt === n) { prev = s / n; out[i] = prev; } }
    else { prev = (prev * (n - 1) + v) / n; out[i] = prev; }
  }
  return out;
}
/** Population standard deviation (Pine ta.stdev). */
export function stdev(x: number[], n: number): number[] {
  const m = sma(x, n);
  return x.map((_, i) => {
    if (Number.isNaN(m[i])) return NaN;
    let s = 0; for (let k = i - n + 1; k <= i; k++) s += (x[k] - m[i]) ** 2; return Math.sqrt(s / n);
  });
}
export function highest(x: number[], n: number): number[] {
  return x.map((_, i) => (i < n - 1 ? NaN : Math.max(...x.slice(i - n + 1, i + 1))));
}
export function lowest(x: number[], n: number): number[] {
  return x.map((_, i) => (i < n - 1 ? NaN : Math.min(...x.slice(i - n + 1, i + 1))));
}
/** Pine ta.linreg(src, n, 0): least-squares line value at the current bar. */
export function linreg(x: number[], n: number): number[] {
  return x.map((_, i) => {
    if (i < n - 1) return NaN;
    let sx = 0, sy = 0, sxy = 0, sxx = 0;
    for (let k = 0; k < n; k++) { const y = x[i - n + 1 + k]; if (Number.isNaN(y)) return NaN; sx += k; sy += y; sxy += k * y; sxx += k * k; }
    const slope = (n * sxy - sx * sy) / (n * sxx - sx * sx); const icpt = (sy - slope * sx) / n;
    return icpt + slope * (n - 1);
  });
}

// ---------- oscillators / bands ----------
export function rsi(close: number[], n: number): number[] {
  const up: number[] = [NaN], dn: number[] = [NaN];
  for (let i = 1; i < close.length; i++) { const d = close[i] - close[i - 1]; up.push(Math.max(d, 0)); dn.push(Math.max(-d, 0)); }
  const ru = rma(up, n), rd = rma(dn, n);
  return ru.map((u, i) => (Number.isNaN(u) ? NaN : rd[i] === 0 ? 100 : u === 0 ? 0 : 100 - 100 / (1 + u / rd[i])));
}
export function trueRange(b: Bar[]): number[] {
  return b.map((x, i) => (i === 0 ? x.h - x.l : Math.max(x.h - x.l, Math.abs(x.h - b[i - 1].c), Math.abs(x.l - b[i - 1].c))));
}
export const atr = (b: Bar[], n: number) => rma(trueRange(b), n);

export function bollinger(close: number[], n = 20, k = 2) {
  const mid = sma(close, n), sd = stdev(close, n);
  return { mid, upper: mid.map((m, i) => m + k * sd[i]), lower: mid.map((m, i) => m - k * sd[i]) };
}
export function macd(close: number[], fast = 12, slow = 26, sig = 9) {
  const f = ema(close, fast), s = ema(close, slow);
  const line = f.map((v, i) => v - s[i]); const signal = ema(line, sig);
  return { line, signal, hist: line.map((v, i) => v - signal[i]) };
}

/** Session VWAP, reset each New York trading day. Uses typical price; missing volume counts as 1. */
export function vwap(b: Bar[]): number[] {
  let day = "", pv = 0, vol = 0;
  return b.map((x) => {
    const d = etParts(x.t).date; if (d !== day) { day = d; pv = 0; vol = 0; }
    const v = x.v && x.v > 0 ? x.v : 1; pv += ((x.h + x.l + x.c) / 3) * v; vol += v; return pv / vol;
  });
}

/** Supertrend (Pine ta.supertrend). dir = 1 uptrend, -1 downtrend. */
export function supertrend(b: Bar[], atrLen = 10, mult = 3) {
  const a = atr(b, atrLen); const line: number[] = [], dir: number[] = [];
  let pu = NaN, pl = NaN, pd = 1, pst = NaN;
  b.forEach((x, i) => {
    const hl2 = (x.h + x.l) / 2; if (Number.isNaN(a[i])) { line.push(NaN); dir.push(NaN); return; }
    let ub = hl2 + mult * a[i], lb = hl2 - mult * a[i];
    const pc = i > 0 ? b[i - 1].c : x.c;
    if (!Number.isNaN(pl)) lb = lb > pl || pc < pl ? lb : pl;
    if (!Number.isNaN(pu)) ub = ub < pu || pc > pu ? ub : pu;
    let d: number;
    if (Number.isNaN(pst)) d = 1;
    else if (pst === pu) d = x.c > ub ? 1 : -1;
    else d = x.c < lb ? -1 : 1;
    const st = d === 1 ? lb : ub;
    line.push(st); dir.push(d); pu = ub; pl = lb; pd = d; pst = st;
  });
  void pd;
  return { line, dir };
}

/** TTM-style squeeze (LazyBear formulation): BB(20,2) inside KC(20,1.5 x SMA true range). */
export function squeeze(b: Bar[], n = 20, bbK = 2, kcK = 1.5) {
  const c = b.map((x) => x.c), h = b.map((x) => x.h), l = b.map((x) => x.l);
  const bb = bollinger(c, n, bbK); const rng = sma(trueRange(b), n);
  const on = c.map((_, i) => bb.lower[i] > bb.mid[i] - rng[i] * kcK && bb.upper[i] < bb.mid[i] + rng[i] * kcK);
  const hh = highest(h, n), ll = lowest(l, n), m = sma(c, n);
  const mom = linreg(c.map((v, i) => v - ((hh[i] + ll[i]) / 2 + m[i]) / 2), n);
  return { on, mom };
}

/** Two-pole oscillator, same math as window20Core (clean-room TradingView "Two-Pole Oscillator"). */
export { twoPole } from "./window20Core.ts";

// ---------- helpers ----------
export const crossOver = (a: number[], b: number[], i: number) => i > 0 && a[i] > b[i] && a[i - 1] <= b[i - 1];
export const crossUnder = (a: number[], b: number[], i: number) => i > 0 && a[i] < b[i] && a[i - 1] >= b[i - 1];
export const ok = (...v: number[]) => v.every((x) => Number.isFinite(x));
