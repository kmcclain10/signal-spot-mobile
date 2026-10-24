import { z } from "zod";
import { getStrategy, type BotConfig, type StrategyId, type StrategySignal, type ResolvedSettings } from "./index";
import type { Bar } from "./indicators";

export const separateStrategyIds = ["orb", "vwap_reclaim", "ema_pullback", "ttm_squeeze", "rsi2", "macd_cross", "band_bounce", "supertrend", "donchian"] as const;
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
export const pulseConfigSchema = z.object({
  strategyId: z.enum(separateStrategyIds), name: z.string().trim().min(1).max(60),
  symbols: z.array(z.string().trim().toUpperCase().regex(/^[A-Z][A-Z0-9.]{0,9}$/)).min(1).max(5),
  timeframe: z.union([z.literal(1),z.literal(2),z.literal(4),z.literal(5),z.literal(10),z.literal(15),z.literal(30),z.literal(60),z.literal(1440)]),
  riskLevel: z.enum(["conservative","balanced","aggressive","test"]), instrument: z.enum(["shares","options"]),
  direction: z.enum(["both","long","short"]), allocation: z.number().finite().min(1).max(100000),
  overrides: z.object({ sizePct:z.number().finite().min(1).max(100).optional(),stopLossPct:z.number().finite().min(0.1).max(90).optional(), takeProfitPct:z.number().finite().min(0).max(1000).optional(), trailing:z.boolean().optional(), trailStartPct:z.number().finite().min(0.1).max(1000).optional(), trailLockPct:z.number().finite().min(0).max(1000).optional(), trailStepPct:z.number().finite().min(0.1).max(100).optional(), maxTradesPerDay:z.number().int().min(1).max(50).optional(), dailyLossPct:z.number().finite().min(1).max(100).optional(), useStrategyExit:z.boolean().optional(), useUnderlyingLevels:z.boolean().optional() }).optional(),
  params:z.record(z.string(),z.number().finite()).optional(),session:z.object({entryStart:time.optional(),entryEnd:time.optional(),flatAt:time.optional()}).optional(),
  options:z.object({dte:z.number().int().min(0).max(120),strikeOffset:z.number().int().min(-5).max(5)}).optional(),
  banking:z.object({enabled:z.boolean(),startBalance:z.number().finite().min(1),bankTrigger:z.number().finite().min(1)}).optional(),
  executionMode:z.enum(["auto","confirm","alerts"]),enabled:z.boolean(),
}).superRefine((c,ctx)=>{
  if(!getStrategy(c.strategyId).timeframes.includes(c.timeframe)) ctx.addIssue({code:"custom",message:"Choose a supported chart timeframe"});
  if(new Set(c.symbols).size!==c.symbols.length) ctx.addIssue({code:"custom",message:"Symbols must be unique"});
  if(c.session?.entryStart && c.session.entryEnd && c.session.entryStart>=c.session.entryEnd) ctx.addIssue({code:"custom",message:"Entry end must follow entry start"});
  if(c.banking?.enabled && c.banking.bankTrigger<=c.banking.startBalance) ctx.addIssue({code:"custom",message:"Bank trigger must exceed restart balance"});
  if(c.banking?.enabled && c.banking.startBalance>c.allocation) ctx.addIssue({code:"custom",message:"Restart balance cannot exceed allocation"});
});

export function defaultPulseConfig(id: StrategyId): BotConfig {
  const s=getStrategy(id);
  return {strategyId:id,name:s.botName,symbols:["SPY"],timeframe:s.defaultTimeframe,riskLevel:"balanced",instrument:"shares",direction:"long",allocation:200,executionMode:"auto",enabled:false};
}

/** Validate broker input before handing it to unchanged imported calculations. */
export function evaluatePulseBars(bars:Bar[],s:ResolvedSettings,memo:Set<string>):StrategySignal {
  if(bars.length<s.strategy.minBars) return {note:`Warming up: ${bars.length}/${s.strategy.minBars} closed bars`};
  if(bars.some((b,i)=>!Number.isFinite(Date.parse(b.t)) || ![b.o,b.h,b.l,b.c].every(n=>Number.isFinite(n)&&n>0) || b.h<b.l || (i>0 && Date.parse(b.t)<=Date.parse(bars[i-1].t)))) return {note:"Invalid market bars; entries paused"};
  return s.strategy.evaluate(bars,s.params,{entryStart:s.entryStart,entryEnd:s.entryEnd,timeframe:s.timeframe,memo});
}

export function pulseEntryBlock(input:{enabled:boolean;kill:boolean;balance:number;pnlToday:number;dayBalance:number;trades:number;s:ResolvedSettings}):string|null {
  if(!input.enabled || input.kill) return "Stopped";
  if(!(input.balance>0)) return "Allocation exhausted";
  if(input.trades>=input.s.maxTradesPerDay) return "Daily trade limit reached";
  if(input.pnlToday<=-input.dayBalance*input.s.dailyLossPct/100) return "Daily loss limit reached";
  return null;
}