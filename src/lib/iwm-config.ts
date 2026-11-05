import { DEFAULT_CONFIG, type StrategyConfig } from '@/lib/iwmWindowStrategy';
import { IWM_STOP_PCT } from '@/lib/iwm-trade-policy';

/** Runtime override preserves the supplied strategy implementation and its math. */
export const IWM_TIMEFRAME_MIN = 5;
/** Tracking starts at the 9:30 ET open so opening moves are caught. */
export const IWM_SESSION_START = "09:30";
export function iwmConfigFor(settings: Record<string, any>): StrategyConfig {
  return { ...DEFAULT_CONFIG, timeframeMin: IWM_TIMEFRAME_MIN, sessionStart: IWM_SESSION_START, startingBankroll: Number(settings.starting_bankroll), bankTrigger: Number(settings.bank_trigger), stopLossPct: IWM_STOP_PCT };
}