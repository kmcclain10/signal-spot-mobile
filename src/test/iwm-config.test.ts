import { describe, it, expect } from 'vitest';
import { iwmConfigFor } from '@/lib/iwm-config';
import { DEFAULT_CONFIG } from '@/lib/iwmWindowStrategy';

describe('IWM runtime timeframe', () => {
  it('uses one-minute candles even for legacy two-minute settings without changing other rules', () => {
    expect(iwmConfigFor({ timeframe_min: 2, starting_bankroll: 200, bank_trigger: 25200, stop_loss_pct: 30 })).toEqual({ ...DEFAULT_CONFIG, timeframeMin: 1, startingBankroll: 200, bankTrigger: 25200, stopLossPct: 30 });
  });
});