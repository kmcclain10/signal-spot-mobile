import { iwmScheduleTime } from "@/lib/iwm-engine-rules";

export type BotRun = { ok: boolean; duration_ms: number; started_at: string; finished_at: string; error: string | null };
export type BotHealth = "running" | "paused" | "offline" | "disabled";

/** Overall bot health for the control-center card. */
export function botHealth(now: Date, settings: Record<string, any> | null, state: Record<string, any> | null): { status: BotHealth; detail: string } {
  if (!settings?.enabled) return { status: "disabled", detail: "Turned off" };
  if (settings.kill_switch) return { status: "paused", detail: "Kill switch on" };
  if (state?.needs_review) return { status: "paused", detail: "Needs your review" };
  if (Number(state?.pnl_today ?? 0) <= -Math.abs(Number(settings.max_daily_loss ?? 100))) return { status: "paused", detail: "Daily loss limit reached" };
  if (!iwmScheduleTime(now)) return { status: "running", detail: "Waiting for market hours" };
  if (!state?.last_success_at || now.getTime() - Date.parse(state.last_success_at) > 180000)
    return { status: "offline", detail: "No successful check in 3 minutes" };
  return { status: "running", detail: "Checking every minute" };
}

/** Success rate and average run time over the given runs. */
export function runStats(runs: BotRun[]) {
  const total = runs.length;
  const failures = runs.filter((r) => !r.ok).length;
  const avgDurationMs = total ? Math.round(runs.reduce((s, r) => s + r.duration_ms, 0) / total) : 0;
  return { total, failures, successRate: total ? (total - failures) / total : 1, avgDurationMs };
}

/** How much paper money the bot controls and how close it is to banking. */
export function allocationSummary(settings: Record<string, any>, state: Record<string, any> | null) {
  const allocated = Number(settings.starting_bankroll ?? 200);
  const balance = Number(state?.balance ?? allocated);
  const banked = Number(state?.banked_total ?? 0);
  const trigger = Number(settings.bank_trigger ?? 25200);
  return {
    allocated,
    balance,
    banked,
    trigger,
    progressPct: Math.min(100, (balance / trigger) * 100),
    dailyLossLimit: Number(settings.max_daily_loss ?? 100),
  };
}
