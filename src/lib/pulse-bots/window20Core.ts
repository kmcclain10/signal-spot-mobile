// iwmWindowStrategy.ts — 20-Minute Window Strategy for IWM options.
// Pure logic, no network calls, no dependencies. Works in Deno (Supabase Edge
// Functions), Node and the browser. Port of the tested Python bot.
//
// ENTRY (CALL shown, PUT is the mirror):
//   1. 8 EMA above 20 EMA on the signal bar
//   2. Confirmed 8/20 EMA bull cross on a bar inside the current 20-min window
//   3. Bull two-pole oscillator dot (length 15) inside the same window
//   4. Enter on the close of EXACTLY the 3rd consecutive green candle, counted from the cross bar
//   5. Never on the final bar of the window. Windows: 15 x 20 min, 10:00-15:00 ET
// EXITS (first to happen): close on wrong side of 8 EMA, -30% premium, protected floor breach.
//   Opposite oscillator dots are NOT exits.
// LADDER: peak +35% -> floor +10%, then +10% floor for every +10% peak (continues forever).
// BANKING: bankroll >= $25,200 -> bank everything above $200, restart at $200.

export interface Bar { t: string; o: number; h: number; l: number; c: number; v?: number } // t = bar START time (ISO, any tz)
export type Side = "CALL" | "PUT";

export interface StrategyConfig {
  timeframeMin: number;    // candle size, must divide windowMin (1,2,4,5,10)
  windowMin: number;       // 20
  sessionStart: string;    // "10:00" ET
  sessionEnd: string;      // "15:00" ET
  emaFast: number;         // 8
  emaSlow: number;         // 20
  oscLength: number;       // 15
  stopLossPct: number;     // 30
  ladder: { firstPeak: number; firstFloor: number; step: number }; // 35 / 10 / 10
  startingBankroll: number; // 200
  bankTrigger: number;      // 25200
  feePerContract: number;   // 0 on Alpaca options commission-free; keep configurable
  // ---- risk-profile knobs (defaults = the original infographic rules) ----
  entryCandle: number;      // enter on EXACTLY this consecutive directional candle since the cross (3)
  requireDot: boolean;      // require a matching oscillator dot (true)
  dotLookbackBars: number;  // 0 = dot must be inside the same window; N = dot may be up to N bars back (same day)
  maxTradesPerDay: number;
}

export const DEFAULT_CONFIG: StrategyConfig = {
  timeframeMin: 2, windowMin: 20, sessionStart: "10:00", sessionEnd: "15:00",
  emaFast: 8, emaSlow: 20, oscLength: 15, stopLossPct: 30,
  ladder: { firstPeak: 35, firstFloor: 10, step: 10 },
  startingBankroll: 200, bankTrigger: 25200, feePerContract: 0,
  entryCandle: 3, requireDot: true, dotLookbackBars: 0, maxTradesPerDay: 15,
};

export type RiskProfile = "conservative" | "aggressive" | "test";

/** Conservative = the infographic exactly. Aggressive = same idea, more setups.
 *  Test = fires on almost every 8/20 cross; PAPER ONLY, for proving the pipeline works. */
export const PROFILES: Record<RiskProfile, StrategyConfig> = {
  conservative: { ...DEFAULT_CONFIG },
  aggressive: { ...DEFAULT_CONFIG, timeframeMin: 1, entryCandle: 2, dotLookbackBars: 10, stopLossPct: 35 },
  test: { ...DEFAULT_CONFIG, timeframeMin: 1, entryCandle: 1, requireDot: false, stopLossPct: 20,
          ladder: { firstPeak: 15, firstFloor: 5, step: 10 } },
};
export function profileConfig(p: RiskProfile, overrides: Partial<StrategyConfig> = {}): StrategyConfig {
  return { ...PROFILES[p], ...overrides };
}

// ---------------- time helpers (America/New_York) ----------------
const etFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York", hourCycle: "h23",
  year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
});
export function etParts(iso: string): { date: string; minutes: number } {
  const p = Object.fromEntries(etFmt.formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, minutes: Number(p.hour) * 60 + Number(p.minute) };
}
const hm = (s: string) => { const [h, m] = s.split(":").map(Number); return h * 60 + m; };

export function windowOf(iso: string, cfg = DEFAULT_CONFIG): number | null {
  const { minutes } = etParts(iso);
  const s = hm(cfg.sessionStart), e = hm(cfg.sessionEnd);
  if (minutes < s || minutes >= e) return null;
  return Math.floor((minutes - s) / cfg.windowMin) + 1;
}
export function isFinalBar(iso: string, cfg = DEFAULT_CONFIG): boolean {
  const { minutes } = etParts(iso);
  return (minutes - hm(cfg.sessionStart) + cfg.timeframeMin) % cfg.windowMin === 0;
}

// ---------------- indicators ----------------
export function ema(values: number[], len: number): number[] {
  const a = 2 / (len + 1); const out: number[] = [];
  values.forEach((v, i) => out.push(i === 0 ? v : a * v + (1 - a) * out[i - 1]));
  return out;
}
function rollingMean(x: number[], n: number): number[] {
  return x.map((_, i) => {
    if (i < n - 1) return NaN;
    let s = 0; for (let k = i - n + 1; k <= i; k++) s += x[k]; return s / n;
  });
}
function rollingStd(x: number[], n: number): number[] {
  const m = rollingMean(x, n);
  return x.map((_, i) => {
    if (i < n - 1 || x.slice(i - n + 1, i + 1).some(Number.isNaN)) return NaN;
    let s = 0; for (let k = i - n + 1; k <= i; k++) s += (x[k] - m[i]) ** 2; return Math.sqrt(s / n);
  });
}

/** Two-pole oscillator (clean-room version of TradingView's "Two-Pole Oscillator"). */
export function twoPole(close: number[], length = 15, normLen = 25, lag = 4) {
  const sma1 = rollingMean(close, normLen);
  const dev = close.map((c, i) => c - sma1[i]);
  const devMean = rollingMeanNaN(dev, normLen);
  const devStd = rollingStd(dev, normLen);
  const z = dev.map((d, i) => (d - devMean[i]) / devStd[i]);
  const a = 2 / (length + 1);
  const osc: number[] = []; let s1 = NaN, s2 = NaN;
  for (const v of z) {
    if (!Number.isNaN(v)) {
      s1 = Number.isNaN(s1) ? v : (1 - a) * s1 + a * v;
      s2 = Number.isNaN(s2) ? s1 : (1 - a) * s2 + a * s1;
    }
    osc.push(s2);
  }
  const bullDot: boolean[] = [], bearDot: boolean[] = [];
  osc.forEach((o, i) => {
    const r = osc[i - lag], po = osc[i - 1], pr = osc[i - 1 - lag];
    const ok = i - 1 - lag >= 0 && ![o, r, po, pr].some(Number.isNaN);
    bullDot.push(ok && o > r && po <= pr && o < 0);
    bearDot.push(ok && o < r && po >= pr && o > 0);
  });
  return { osc, bullDot, bearDot };
}
function rollingMeanNaN(x: number[], n: number): number[] {
  return x.map((_, i) => {
    if (i < n - 1) return NaN;
    const w = x.slice(i - n + 1, i + 1); return w.some(Number.isNaN) ? NaN : w.reduce((a, b) => a + b, 0) / n;
  });
}

export interface IndRow extends Bar {
  emaFast: number; emaSlow: number; bullCross: boolean; bearCross: boolean;
  osc: number; bullDot: boolean; bearDot: boolean; green: boolean; red: boolean;
}
export function addIndicators(bars: Bar[], cfg = DEFAULT_CONFIG): IndRow[] {
  const c = bars.map((b) => b.c);
  const f = ema(c, cfg.emaFast), s = ema(c, cfg.emaSlow);
  const tp = twoPole(c, cfg.oscLength);
  return bars.map((b, i) => {
    const above = f[i] > s[i], prevAbove = i === 0 ? null : f[i - 1] > s[i - 1];
    return {
      ...b, emaFast: f[i], emaSlow: s[i],
      bullCross: prevAbove === false && above, bearCross: prevAbove === true && !above,
      osc: tp.osc[i], bullDot: tp.bullDot[i], bearDot: tp.bearDot[i], green: b.c > b.o, red: b.c < b.o,
    };
  });
}

// ---------------- entry signals ----------------
export interface Signal { kind: "potential" | "entry"; side: Side; barTime: string; window: number; price: number; detail: string }

/**
 * Evaluate the LAST (just-closed) bar. `alerted` is a persisted set of keys
 * (store it in your DB per day) so each window fires once per side.
 */
export function evaluate(rows: IndRow[], alerted: Set<string>, cfg = DEFAULT_CONFIG): Signal[] {
  const out: Signal[] = [];
  const last = rows[rows.length - 1];
  const w = windowOf(last.t, cfg);
  if (w === null) return out;
  const { date } = etParts(last.t);
  const win: IndRow[] = [];
  for (let i = rows.length - 1; i >= 0; i--) {   // walk back only through the current window
    const r = rows[i];
    if (etParts(r.t).date !== date || windowOf(r.t, cfg) !== w) break;
    win.unshift(r);
  }

  const sides: [Side, keyof IndRow, keyof IndRow, keyof IndRow, boolean][] = [
    ["CALL", "bullCross", "bullDot", "green", last.emaFast > last.emaSlow],
    ["PUT", "bearCross", "bearDot", "red", last.emaFast < last.emaSlow],
  ];
  const lastIdx = rows.length - 1;
  for (const [side, crossK, dotK, candleK, aligned] of sides) {
    if (!aligned) continue;
    const crossIdx = win.map((r, i) => (r[crossK] ? i : -1)).filter((i) => i >= 0);
    if (!crossIdx.length) continue;
    let dotTime: string | null = null;
    if (cfg.requireDot) {
      const pool = cfg.dotLookbackBars > 0
        ? rows.slice(Math.max(0, lastIdx - cfg.dotLookbackBars), lastIdx + 1).filter((r) => etParts(r.t).date === date)
        : win;
      const dots = pool.filter((r) => r[dotK]);
      if (!dots.length) continue;
      dotTime = dots[dots.length - 1].t;
    }
    const ci = crossIdx[crossIdx.length - 1];
    const key = `${date}|${w}|${side}`;
    if (!alerted.has(key)) {
      alerted.add(key);
      out.push({ kind: "potential", side, barTime: last.t, window: w, price: last.c,
        detail: `cross ${win[ci].t}${dotTime ? `, dot ${dotTime}` : ", no dot required"}` });
    }
    let streak = 0;
    for (let i = win.length - 1; i >= ci && win[i][candleK]; i--) streak++;
    if (streak === cfg.entryCandle && !isFinalBar(last.t, cfg) && !alerted.has(key + "|entry")) {
      alerted.add(key + "|entry");
      out.push({ kind: "entry", side, barTime: last.t, window: w, price: last.c,
        detail: `candle #${cfg.entryCandle} since cross` });
    }
  }
  return out;
}

// ---------------- trade management ----------------
export function protectedFloor(peakGainPct: number, l = DEFAULT_CONFIG.ladder): number | null {
  if (peakGainPct < l.firstPeak) return null;
  return l.firstFloor + Math.floor((peakGainPct - l.firstPeak) / l.step + 1e-9) * l.step;
}

export interface OpenTrade {
  side: Side; optionSymbol: string; strike: number; contracts: number;
  entryPremium: number; peakPremium: number; floorPct: number | null; entryCloseTime: string; // bar CLOSE time of entry bar
}

/** Call on every premium poll. Mutates trade.peakPremium / floorPct. */
export function onPremium(trade: OpenTrade, premium: number, cfg = DEFAULT_CONFIG): { exitReason: string | null; newFloor: number | null } {
  let newFloor: number | null = null;
  if (premium > trade.peakPremium) {
    trade.peakPremium = premium;
    const f = protectedFloor((premium / trade.entryPremium - 1) * 100, cfg.ladder);
    if (f !== null && (trade.floorPct === null || f > trade.floorPct)) trade.floorPct = newFloor = f;
  }
  const g = (premium / trade.entryPremium - 1) * 100;
  if (g <= -cfg.stopLossPct) return { exitReason: `-${cfg.stopLossPct}% option stop`, newFloor };
  if (trade.floorPct !== null && g <= trade.floorPct) return { exitReason: `protected floor +${trade.floorPct}% breached`, newFloor };
  return { exitReason: null, newFloor };
}

/** Call on every newly closed bar while in a trade. */
export function emaDisrespect(trade: OpenTrade, last: IndRow): string | null {
  if (new Date(last.t) < new Date(trade.entryCloseTime)) return null;
  const wrong = trade.side === "CALL" ? last.c < last.emaFast : last.c > last.emaFast;
  return wrong ? `8 EMA disrespect (close ${last.c.toFixed(2)} vs ${last.emaFast.toFixed(2)})` : null;
}

// ---------------- bankroll ----------------
export interface BankState { balance: number; bankedTotal: number; cycles: number }
export function contractsFor(bank: BankState, premium: number, cfg = DEFAULT_CONFIG): number {
  return Math.max(0, Math.floor(bank.balance / (premium * 100 + cfg.feePerContract * 2)));
}
/** Apply realized P&L; returns banked amount when a banking event happens. */
export function settle(bank: BankState, pnl: number, cfg = DEFAULT_CONFIG): number | null {
  bank.balance = Math.round((bank.balance + pnl) * 100) / 100;
  if (bank.balance >= cfg.bankTrigger) {
    const amt = Math.round((bank.balance - cfg.startingBankroll) * 100) / 100;
    bank.bankedTotal = Math.round((bank.bankedTotal + amt) * 100) / 100;
    bank.balance = cfg.startingBankroll; bank.cycles += 1;
    return amt;
  }
  return null;
}

/** OCC option symbol, e.g. IWM261016C00273000 */
export function occSymbol(root: string, expiry: string, side: Side, strike: number): string {
  const [y, m, d] = expiry.split("-");
  return `${root}${y.slice(2)}${m}${d}${side[0]}${String(Math.round(strike * 1000)).padStart(8, "0")}`;
}
