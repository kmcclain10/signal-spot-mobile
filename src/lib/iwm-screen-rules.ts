import { z } from "zod";
import { etParts, windowOf } from "@/lib/iwmWindowStrategy";

export const iwmSettingsInput = z.object({
  enabled: z.boolean().optional(),
  timeframe_min: z.union([z.literal(1), z.literal(2), z.literal(4), z.literal(5), z.literal(10)]).optional(),
  stop_loss_pct: z.number().positive().max(100).optional(),
  max_trades_per_day: z.number().int().min(1).max(100).optional(),
  force_exit_time: z.string().regex(/^1[0-5]:[0-5][0-9]$/).refine(v => v <= "15:50", "Must be no later than 15:50 ET").optional(),
  data_feed: z.enum(["iex", "sip"]).optional(),
  options_feed: z.enum(["indicative", "opra"]).optional(),
  discord_enabled: z.boolean().optional(),
}).strict();

export function iwmScreenStatus(now: Date, state: Record<string, any> | null, enabled: boolean, maxTrades = 15) {
  if (state?.pending_order) return { label: "Order pending", remaining: null };
  if (state?.open_trade) return { label: "In trade", remaining: null };
  if (!enabled) return { label: "Disabled", remaining: null };
  const iso = now.toISOString(), {date, minutes} = etParts(iso);
  const weekday = new Intl.DateTimeFormat("en-US", {timeZone:"America/New_York", weekday:"short"}).format(now);
  if (["Sat", "Sun"].includes(weekday)) return {label:"Waiting for next session",remaining:null};
  if (minutes < 600) return {label:"Waiting for 10:00 ET",remaining:null};
  if (minutes >= 900 || (state?.trading_day === date && state.trades_today >= maxTrades)) return {label:"Done for today",remaining:null};
  const window = windowOf(iso);
  const remaining = (20 - (minutes - 600) % 20) * 60 - now.getUTCSeconds();
  if (!state?.last_run_at || now.getTime() - Date.parse(state.last_run_at) > 150000) return {label:"Waiting for runner",remaining};
  return {label:`Scanning • Window ${window}/15`,remaining};
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