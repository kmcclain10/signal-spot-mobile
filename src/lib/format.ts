export const pct = (x: number | null | undefined, d = 0) =>
  x == null || Number.isNaN(x) ? "—" : `${(x * 100).toFixed(d)}%`;
export const num = (x: number | null | undefined, d = 2) =>
  x == null || Number.isNaN(Number(x)) ? "—" : Number(x).toFixed(d);
export const usd = (x: number | null | undefined) =>
  x == null || Number.isNaN(Number(x))
    ? "—"
    : Number(x).toLocaleString("en-US", { style: "currency", currency: "USD" });
export const signed = (x: number | null | undefined, d = 2) =>
  x == null ? "—" : `${x >= 0 ? "+" : ""}${Number(x).toFixed(d)}`;

export function timeAgo(iso: string | null | undefined) {
  if (!iso) return "never";
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export const nyTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit" });

/** Order size: qty = floor(risk$ / |entry − stop|), minimum 1. */
export function positionSize(riskUsd: number, entry: number, stop: number) {
  const d = Math.abs(entry - stop);
  if (!(d > 0)) return 1;
  return Math.max(1, Math.floor(riskUsd / d));
}

export function rewardRisk(side: string, entry: number, stop: number, target: number | null) {
  if (target == null) return null;
  const risk = Math.abs(entry - stop);
  if (!risk) return null;
  return Math.abs(target - entry) / risk;
}
