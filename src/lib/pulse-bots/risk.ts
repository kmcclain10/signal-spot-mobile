// risk.ts — risk levels, user-adjustable bot settings, and the shared exit manager.
// Every bot uses the same exits: stop loss %, take profit %, trailing profit ladder,
// optional underlying stop/target from the strategy, the strategy's own exit, and a time exit.

import type { Dir, RiskLevel, StrategyDef, StrategyId, Timeframe } from "./strategies.ts";
import { RISK_INDEX, getStrategy } from "./strategies.ts";

export type Instrument = "shares" | "options";
export interface RiskDefaults {
  sizePct: number;        // % of the bot's current balance per trade
  stopLossPct: number;    // % loss on the position (option premium, or share price)
  takeProfitPct: number;  // % gain to take profit; 0 = off (let the trailing ladder run)
  trailing: boolean;
  trailStartPct: number;  // peak gain that arms the ladder
  trailLockPct: number;   // first locked floor
  trailStepPct: number;   // floor rises this much for every step of peak gain
  maxTradesPerDay: number;
  dailyLossPct: number;   // stop new entries after losing this % of the bot's balance today
}
const R = (sizePct: number, stopLossPct: number, takeProfitPct: number, trailStartPct: number, trailLockPct: number,
  trailStepPct: number, maxTradesPerDay: number, dailyLossPct: number): RiskDefaults =>
  ({ sizePct, stopLossPct, takeProfitPct, trailing: true, trailStartPct, trailLockPct, trailStepPct, maxTradesPerDay, dailyLossPct });

/** Balanced + options = the original infographic exits (-30% stop, +35% locks +10%, +10 steps, no fixed target). */
export const RISK_LEVELS: Record<RiskLevel, { label: string; blurb: string; options: RiskDefaults; shares: RiskDefaults }> = {
  conservative: { label: "Conservative", blurb: "Strictest signals, small size, tight stops, takes profit early",
    options: R(10, 25, 50, 25, 5, 10, 3, 5), shares: R(10, 1, 2, 1, 0.25, 0.5, 3, 2) },
  balanced: { label: "Balanced", blurb: "The standard rules for each strategy",
    options: R(25, 30, 0, 35, 10, 10, 6, 10), shares: R(25, 1.5, 3, 1.5, 0.5, 0.5, 6, 4) },
  aggressive: { label: "Aggressive", blurb: "Looser signals, bigger size, wider stops, lets winners run",
    options: R(50, 40, 0, 50, 20, 10, 10, 20), shares: R(50, 2.5, 0, 2.5, 1, 1, 10, 8) },
  test: { label: "Test (paper only)", blurb: "Fires often so you can see the bot work; never allowed on a live account",
    options: R(10, 20, 0, 15, 5, 10, 20, 50), shares: R(10, 0.5, 0, 0.5, 0.1, 0.25, 20, 50) },
};

export interface BotConfig {
  strategyId: StrategyId;
  name?: string;
  symbols: string[];
  timeframe?: Timeframe;
  riskLevel: RiskLevel;
  instrument: Instrument;
  direction: "both" | "long" | "short";
  allocation: number;                       // $ assigned to this bot
  overrides?: Partial<RiskDefaults> & { useStrategyExit?: boolean; useUnderlyingLevels?: boolean };
  params?: Record<string, number>;          // strategy parameter overrides
  session?: { entryStart?: string; entryEnd?: string; flatAt?: string };
  options?: { dte?: number; strikeOffset?: number }; // dte 0 = same day; strikeOffset 0 = ATM, 1 = 1 strike OTM
  banking?: { enabled: boolean; startBalance: number; bankTrigger: number };
  executionMode: "auto" | "confirm" | "alerts";
  enabled: boolean;
}

export interface ResolvedSettings extends RiskDefaults {
  strategy: StrategyDef; timeframe: Timeframe; params: Record<string, number>;
  instrument: Instrument; direction: BotConfig["direction"]; riskLevel: RiskLevel;
  useStrategyExit: boolean; useUnderlyingLevels: boolean;
  entryStart: string; entryEnd: string; flatAt: string | null;
  optionDte: number; strikeOffset: number; warnings: string[];
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Merge risk-level defaults + user overrides, clamp everything to safe ranges. Throws on unsafe combos. */
export function resolveBotSettings(cfg: BotConfig, account: { isPaper: boolean }): ResolvedSettings {
  const s = getStrategy(cfg.strategyId); const warnings: string[] = [];
  if (cfg.riskLevel === "test" && !account.isPaper) throw new Error("Test risk level is paper only");
  let tf = cfg.timeframe ?? s.defaultTimeframe;
  if (!s.timeframes.includes(tf)) { warnings.push(`${tf}-min not supported by ${s.botName}; using ${s.defaultTimeframe}`); tf = s.defaultTimeframe; }
  const idx = RISK_INDEX[cfg.riskLevel];
  const params: Record<string, number> = {};
  for (const ps of s.params) {
    const v = cfg.params?.[ps.key] ?? ps.presets[idx];
    params[ps.key] = clamp(Math.round(v / ps.step) * ps.step, ps.min, ps.max);
  }
  const intraday = s.style === "intraday" && tf !== 1440;
  const lvl = RISK_LEVELS[cfg.riskLevel][cfg.instrument];
  // Share bots on daily candles need wider stops/targets than intraday ones (x3).
  const k = !intraday && cfg.instrument === "shares" ? 3 : 1;
  const base: RiskDefaults = { ...lvl, stopLossPct: lvl.stopLossPct * k, takeProfitPct: lvl.takeProfitPct * k,
    trailStartPct: lvl.trailStartPct * k, trailLockPct: lvl.trailLockPct * k, trailStepPct: lvl.trailStepPct * k };
  const o = cfg.overrides ?? {};
  const r: RiskDefaults = {
    sizePct: clamp(o.sizePct ?? base.sizePct, 1, 100),
    stopLossPct: clamp(o.stopLossPct ?? base.stopLossPct, 0.1, cfg.instrument === "options" ? 90 : 25),
    takeProfitPct: clamp(o.takeProfitPct ?? base.takeProfitPct, 0, 1000),
    trailing: o.trailing ?? base.trailing,
    trailStartPct: clamp(o.trailStartPct ?? base.trailStartPct, 0.1, 1000),
    trailLockPct: clamp(o.trailLockPct ?? base.trailLockPct, 0, 1000),
    trailStepPct: clamp(o.trailStepPct ?? base.trailStepPct, 0.1, 100),
    maxTradesPerDay: clamp(o.maxTradesPerDay ?? base.maxTradesPerDay, 1, 50),
    dailyLossPct: clamp(o.dailyLossPct ?? base.dailyLossPct, 1, 100),
  };
  if (r.trailLockPct >= r.trailStartPct) { r.trailLockPct = r.trailStartPct / 2; warnings.push("Trail lock must be below trail start; adjusted"); }
  const ent = cfg.session?.entryStart ?? (s.id === "window20" ? "10:00" : s.id === "orb" ? "09:30" : "09:45");
  const end = cfg.session?.entryEnd ?? (s.id === "window20" ? "15:00" : "15:30");
  const flat = cfg.session?.flatAt ?? (intraday || cfg.instrument === "options" && (cfg.options?.dte ?? 0) === 0 ? "15:50" : null);
  for (const t of [ent, end, flat]) if (t !== null && !HHMM.test(t)) throw new Error(`Bad time ${t}, use HH:MM`);
  const dte = clamp(cfg.options?.dte ?? (intraday ? 0 : 21), 0, 120);
  if (!intraday && cfg.instrument === "options" && dte < 7) warnings.push("Swing bots usually need 7+ days to expiration");
  return { ...r, strategy: s, timeframe: tf, params, instrument: cfg.instrument, direction: cfg.direction, riskLevel: cfg.riskLevel,
    useStrategyExit: o.useStrategyExit ?? true, useUnderlyingLevels: o.useUnderlyingLevels ?? true,
    entryStart: ent, entryEnd: end, flatAt: flat, optionDte: dte, strikeOffset: clamp(cfg.options?.strikeOffset ?? 0, -5, 5), warnings };
}

// ---------------- exit manager ----------------
export interface OpenPosition {
  side: Dir; instrument: Instrument;
  entryPrice: number;            // option premium or share price
  peakGainPct: number; floorPct: number | null;
  underlyingStop?: number; underlyingTarget?: number;
  openedBarTime: string;         // bar START time of the entry bar
}
export function gainPct(p: OpenPosition, mark: number): number {
  if (p.instrument === "shares" && p.side === "short") return ((p.entryPrice - mark) / p.entryPrice) * 100;
  return (mark / p.entryPrice - 1) * 100; // long shares, or a bought call/put
}
export function ladderFloor(peak: number, s: Pick<RiskDefaults, "trailStartPct" | "trailLockPct" | "trailStepPct">): number | null {
  if (peak < s.trailStartPct) return null;
  return s.trailLockPct + Math.floor((peak - s.trailStartPct) / s.trailStepPct + 1e-9) * s.trailStepPct;
}

/** Call on every price poll. Mutates peak/floor. Returns an exit reason and/or a newly locked floor. */
export function onMark(p: OpenPosition, mark: number, underlying: number | null, s: ResolvedSettings):
  { exit: string | null; newFloor: number | null } {
  const g = gainPct(p, mark); let newFloor: number | null = null;
  if (g > p.peakGainPct) {
    p.peakGainPct = g;
    if (s.trailing) { const f = ladderFloor(g, s); if (f !== null && (p.floorPct === null || f > p.floorPct)) p.floorPct = newFloor = f; }
  }
  if (g <= -s.stopLossPct) return { exit: `Stop loss -${s.stopLossPct}%`, newFloor };
  if (s.useUnderlyingLevels && underlying !== null) {
    const longish = p.side === "long";
    if (p.underlyingStop !== undefined && (longish ? underlying <= p.underlyingStop : underlying >= p.underlyingStop))
      return { exit: `Underlying stop ${p.underlyingStop.toFixed(2)} hit`, newFloor };
    if (p.underlyingTarget !== undefined && (longish ? underlying >= p.underlyingTarget : underlying <= p.underlyingTarget))
      return { exit: `Underlying target ${p.underlyingTarget.toFixed(2)} hit`, newFloor };
  }
  if (p.floorPct !== null && g <= p.floorPct) return { exit: `Profit floor +${p.floorPct}% hit`, newFloor };
  if (s.takeProfitPct > 0 && g >= s.takeProfitPct) return { exit: `Take profit +${s.takeProfitPct}%`, newFloor };
  return { exit: null, newFloor };
}

/** Strategy exit applies only on bars after the entry bar. */
export function strategyExit(p: OpenPosition, sig: { exitLong?: string; exitShort?: string }, barTime: string, s: ResolvedSettings): string | null {
  if (!s.useStrategyExit || new Date(barTime) <= new Date(p.openedBarTime)) return null;
  return (p.side === "long" ? sig.exitLong : sig.exitShort) ?? null;
}

/** Position size. Options: whole contracts (premium x 100). Shares: whole shares. 0 = skip. */
export function positionSize(balance: number, price: number, s: Pick<ResolvedSettings, "sizePct" | "instrument">): number {
  const budget = (balance * s.sizePct) / 100;
  return Math.max(0, Math.floor(budget / (s.instrument === "options" ? price * 100 : price)));
}

/** Map a strategy direction to what gets bought. */
export const optionTypeFor = (side: Dir) => (side === "long" ? "call" : "put");
