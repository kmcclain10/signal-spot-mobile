import { DEFAULT_CONFIG, type StrategyConfig } from '@/lib/iwmWindowStrategy';

/** Runtime override preserves the supplied strategy implementation and its math. */
export const IWM_TIMEFRAME_MIN = 1;
export function iwmConfigFor(settings: Record<string, any>): StrategyConfig {
  return { ...DEFAULT_CONFIG, timeframeMin: IWM_TIMEFRAME_MIN, startingBankroll: Number(settings.starting_bankroll), bankTrigger: Number(settings.bank_trigger), stopLossPct: Number(settings.stop_loss_pct) };
}