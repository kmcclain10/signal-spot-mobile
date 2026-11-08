import { z } from "zod";
import { etParts } from "@/lib/iwmWindowStrategy";

export const iwmSettingsInput = z.object({
  enabled: z.boolean().optional(),
  timeframe_min: z.literal(1).optional(),
  stop_loss_pct: z.literal(20).optional(),
  max_trades_per_day: z.number().int().min(1).max(100).optional(),
  force_exit_time: z.string().regex(/^1[0-5]:[0-5][0-9]$/).refine(v => v <= "15:40", "Must be no later than 15:40 ET").optional(),
  data_feed: z.enum(["iex", "sip"]).optional(),
  options_feed: z.enum(["indicative", "opra"]).optional(),
  discord_enabled: z.boolean().optional(),
  kill_switch: z.boolean().optional(),
  max_daily_loss: z.number().positive().max(100000).optional(),
  trading_env: z.enum(["paper", "live"]).optional(),
}).strict();

const clock = (m: number) => `${Math.floor(m / 60) > 12 ? Math.floor(m / 60) - 12 : Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;
/** ET clock range of a 20-minute window: window 1 = 9:30–9:50, window 17 = 2:50–3:00. */
export function windowRange(window: number) {
  const start = 570 + (window - 1) * 20;
  return `${clock(start)}–${clock(Math.min(900, start + 20))} ET`;
}

export function iwmScreenStatus(now: Date, state: Record<string, any> | null, enabled: boolean, maxTrades = 15) {
  if (state?.pending_order) return { label: "Order pending", remaining: null };
  if (state?.open_trade) return { label: "In trade", remaining: null };
  if (!enabled) return { label: "Disabled", remaining: null };
  const iso = now.toISOString(), {date, minutes} = etParts(iso);
  const weekday = new Intl.DateTimeFormat("en-US", {timeZone:"America/New_York", weekday:"short"}).format(now);
  if (["Sat", "Sun"].includes(weekday)) return {label:"Waiting for next session",remaining:null};
  if (minutes < 570) return {label:"Waiting for 9:30 ET",remaining:null};
  if (minutes >= 900 || (state?.trading_day === date && state.trades_today >= maxTrades)) return {label:"Done for today",remaining:null};
  const window = Math.floor((minutes - 570) / 20) + 1;
  const remaining = (Math.min(20 - (minutes - 570) % 20, 900 - minutes)) * 60 - now.getUTCSeconds();
  if (!state?.last_run_at || now.getTime() - Date.parse(state.last_run_at) > 150000) return {label:"Waiting for runner",remaining};
  return {label:`Scanning • Window ${window}/17 (${windowRange(window)})`,remaining};
}

export const journalColumns = {
  Trades: ["id","user_id","side","option_symbol","strike","expiry","window","contracts","entry_time","entry_premium","entry_underlying","exit_time","exit_premium","exit_underlying","peak_premium","peak_gain_pct","final_floor_pct","gain_pct","pnl","exit_reason","bankroll_after","cycle","alpaca_entry_order_id","alpaca_exit_order_id","status"],
  Signals: ["id","user_id","created_at","bar_time","window","kind","side","price","ema8","ema20","osc","detail","action"],
  Protection: ["id","user_id","trade_id","created_at","premium","peak_gain_pct","floor_locked_pct"],
  "Bank Events": ["id","user_id","created_at","amount_banked","banked_total","restart_balance","new_cycle"],
  Daily: ["id","user_id","day","trades","wins","losses","win_rate","pnl","banked_today","banked_total","ending_bankroll"],
} as const;
export type Journal = Record<keyof typeof journalColumns, Record<string, any>[]>;
export function journalDay(row: Record<string,any>, sheet: keyof Journal) {
  if (sheet === "Daily") return row.day;
  const time = sheet === "Trades" ? row.entry_time : row.created_at;
  return time ? etParts(time).date : "";
}