// Plain-English names for engine strategy ids like "orb(6)/L/stop0.3/2R".
export type ParsedStrategy = {
  family: string;
  params: number[];
  side: "long" | "short";
  stop: number;
  target: number | null;
};

export function parseStrategyId(id: string): ParsedStrategy | null {
  const m = /^([a-z_]+)\(([^)]*)\)\/(L|S)\/stop([\d.]+)\/(close|[\d.]+R)$/.exec(id);
  if (!m) return null;
  return {
    family: m[1],
    params: m[2] ? m[2].split(",").map(Number) : [],
    side: m[3] === "L" ? "long" : "short",
    stop: Number(m[4]),
    target: m[5] === "close" ? null : Number(m[5].slice(0, -1)),
  };
}

export function barTime(t: number) {
  const mins = 9 * 60 + 30 + 5 * t;
  const h = Math.floor(mins / 60);
  const mm = String(mins % 60).padStart(2, "0");
  const h12 = h > 12 ? h - 12 : h;
  return `${h12}:${mm}${h >= 12 ? "pm" : "am"}`;
}

export function setupName(family: string, p: number[]): string {
  switch (family) {
    case "orb":
      return `${p[0] * 5}-min opening range breakout`;
    case "gap_and_go":
      return `Gap & go (gap > ${p[0]} ATR)`;
    case "gap_fade":
      return `Gap fade (gap > ${p[0]} ATR, by ${p[1] * 5} min)`;
    case "prior_day_break":
      return "Prior-day high/low break";
    case "vwap_reclaim":
      return `VWAP reclaim (stretched ${p[0]} ATR)`;
    case "momentum_at":
      return `Momentum at ${barTime(p[0])} (> ${p[1]} ATR)`;
    case "reversion_at":
      return `Reversion at ${barTime(p[0])} (> ${p[1]} ATR)`;
    case "trend_pullback":
      return "Trend pullback to 9-EMA";
    case "narrow_range_orb":
      return "Narrow-range day ORB";
    case "power_hour":
      return "Power hour momentum";
    default:
      return family;
  }
}

export const FAMILY_LABEL: Record<string, string> = {
  orb: "Opening range breakout",
  gap_and_go: "Gap & go",
  gap_fade: "Gap fade",
  prior_day_break: "Prior-day break",
  vwap_reclaim: "VWAP reclaim",
  momentum_at: "Momentum at time",
  reversion_at: "Reversion at time",
  trend_pullback: "Trend pullback",
  narrow_range_orb: "Narrow-range ORB",
  power_hour: "Power hour",
};

export const FAMILY_DESCRIPTION: Record<string, string> = {
  orb: "Enters when price breaks above (long) or below (short) the high/low of the first minutes of the session.",
  gap_and_go: "Trades in the direction of a large overnight gap once the open confirms it.",
  gap_fade: "Bets that a large overnight gap partially fills within the first part of the session.",
  prior_day_break: "Enters when price breaks yesterday's high (long) or low (short).",
  vwap_reclaim: "After price stretches away from VWAP, enters when it crosses back through VWAP.",
  momentum_at: "At a fixed time of day, follows the direction of a large move from the open.",
  reversion_at: "At a fixed time of day, fades a large move from the open.",
  trend_pullback: "In a trending session, enters on a pullback to the 9-period EMA.",
  narrow_range_orb: "Opening range breakout, only on days after an unusually narrow range.",
  power_hour: "Follows the day's direction into the final hour of trading.",
};

export function strategyName(id: string): string {
  const s = parseStrategyId(id);
  if (!s) return id;
  return `${setupName(s.family, s.params)} · ${s.side === "long" ? "Long" : "Short"} · stop ${s.stop} ATR · ${
    s.target == null ? "exit at close" : `target ${s.target}R`
  }`;
}

export function strategySetup(id: string): string {
  const s = parseStrategyId(id);
  return s ? setupName(s.family, s.params) : id;
}
