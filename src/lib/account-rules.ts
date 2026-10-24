export const BACKGROUND_LOCK_MS = 15 * 60 * 1000;
export const DISCLOSURE_VERSION = "2026-10-24";
export function backgroundLockDue(hiddenAt: number | null, now: number) {
  return hiddenAt !== null && now - hiddenAt >= BACKGROUND_LOCK_MS;
}
export function sensitiveIwmChange(old: Record<string, unknown>, next: Record<string, unknown>) {
  if (old.kill_switch === true && (next.kill_switch === false || next.enabled === true)) return true;
  return ["max_daily_loss", "stop_loss_pct", "max_trades_per_day", "force_exit_time"].some(k => next[k] !== undefined && next[k] !== old[k]);
}
export function sensitiveAccountChange(old: Record<string, unknown>, next: Record<string, unknown>) {
  return (next.trading_mode === "live" && old.trading_mode !== "live") || ["risk_per_trade_usd", "max_open_positions", "max_daily_loss_usd"].some(k => Number(next[k]) !== Number(old[k]));
}