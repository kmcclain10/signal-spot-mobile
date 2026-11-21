import { PLAYBOOK } from '@/lib/strategy-platform';
import { defaultPulseConfig } from '@/lib/pulse-bots/config';
import { resolveBotSettings } from '@/lib/pulse-bots/risk';
import { STRATEGIES } from '@/lib/pulse-bots/strategies';
import { IWM_TRAIL_START_PCT, IWM_TRAIL_PTS, IWM_MAX_TARGET_PCT } from '@/lib/iwm-trade-policy';

/** Presentation only. The scanner uses balanced defaults, not a customer's bot overrides. */
export function publicStrategy(id: string) {
  const base = PLAYBOOK.find(s => s.id === id);
  if (!base) return undefined;
  if (id === 'iwm') return { ...base, summary: 'The IWM bot uses at-the-money IWM options on confirmed 5-minute 9/20 EMA crosses. Read-only momentum alerts also evaluate this cross across the selected scan universe.', rules: [
    'IWM bot: CALL on a bullish 9/20 EMA cross; PUT on a bearish cross, using confirmed 5-minute candles.',
    'Bot entries start at 9:30 AM ET and stop at 3:00 PM ET.',
    'The bot budgets no more than half the available strategy balance per trade, rounded down to whole option contracts.',
    'There is no price stop. The bot requests liquidation by 3:40 PM ET, or earlier on shortened sessions. Orders may not fill in time and options can lose substantial value before exit.',
    `A trailing exit activates after a peak gain of ${IWM_TRAIL_START_PCT}% and requests a full exit if the gain falls ${IWM_TRAIL_PTS} percentage points below that peak. Execution is not guaranteed.`,
    `The +${IWM_MAX_TARGET_PCT}% exit ceiling is a maximum-gain exit rule, not a target or an expected return.`,
    'An opposite cross requests closing the IWM position and switching direction.',
    'The bot allocates half of each winning trade’s realized profit toward fractional Walmart shares (WMT). Purchases are queued until at least $1 is available and orders can be submitted. This is a bot allocation rule, not advice to buy Walmart.',
  ] };
  const strategy = STRATEGIES.find(s => s.id === id);
  if (!strategy) return undefined;
  const settings = resolveBotSettings(defaultPulseConfig(strategy.id), { isPaper: true });
  const p = settings.params;
  const rules: Record<string, () => string[]> = {
    orb: () => [`Opening range: high and low of the first ${p.orMinutes} minutes after 9:30 AM ET.`, 'CALL direction on the first close above the range high; PUT direction below the range low.', `Underlying stop at the opposite side of the range; underlying target ${p.rMultiple} times the entry-to-stop distance. This is not an option-premium return target.`, `Entry bars must start before ${etTime(570 + p.cutoffMinutes)} ET. The strategy evaluator uses one entry per side per day when used with the bot’s persisted memo. Read-only alerts do not enforce an account-wide daily trade limit.`],
    vwap_reclaim: () => [`Price must spend ${p.minBelowBars} consecutive prior bars below VWAP before a close back above it; the short setup mirrors this.`, `${p.emaLen} EMA confirmation is ${p.requireEma === 1 ? 'on' : 'off'}; the above-average-volume filter is ${p.requireVolume === 1 ? 'on' : 'off'} in the alert scanner.`, 'Strategy exit: close back through VWAP against the position.'],
    ema_pullback: () => [`Trend: ${p.fast} EMA above ${p.mid} EMA above ${p.slow} EMA; reversed for shorts.`, `Pullback touches the ${p.mid} EMA within the recent ${p.pullbackBars}-bar lookback, with ${p.touchTolPct}% touch tolerance.`, `Entry closes back across the ${p.fast} EMA in the trend direction; strategy exit closes across the ${p.mid} EMA against it.`],
    ttm_squeeze: () => [`Bollinger Bands (20 bars, 2 standard deviations) stay inside Keltner Channels (20 bars, ${p.kcMult} ATR) for at least ${p.minSqueezeBars} prior bars.`, 'Entry when the bands expand outside the channels and momentum is above zero and rising for CALL direction, or below zero and falling for PUT direction.', `Strategy exit after momentum fades for ${p.fadeBars} consecutive bars.`],
    rsi2: () => [`Daily close above the ${p.trendLen}-day SMA for a long setup; below for a short setup.`, `Long entry: RSI(2) crosses below ${p.entryRsi} and price is below the ${p.exitLen}-day SMA. Short entry: RSI(2) crosses above ${100 - p.entryRsi} with price above that SMA.`, `Strategy exit: close back above the ${p.exitLen}-day SMA for longs, or below it for shorts.`],
    macd_cross: () => [`MACD (12, 26, 9) crosses its signal line in the direction of price relative to the ${p.trendLen}-bar EMA.`, `The far-side-of-zero cross filter is ${p.requireZeroSide === 1 ? 'on' : 'off'} in the alert scanner.`, 'Strategy exit: MACD crosses its signal line against the position.'],
    band_bounce: () => [`Bollinger Bands use 20 bars and ${p.bbMult} standard deviations. A prior close outside the band is followed by a close back inside.`, `Prior RSI(14) must be below ${p.rsiMax} for longs or above ${100 - p.rsiMax} for shorts. The 200-bar trend filter is ${p.trendFilter === 1 ? 'on' : 'off'}.`, 'Strategy exit: price reaches the middle band.'],
    supertrend: () => [`Supertrend uses ATR length ${p.atrLen} with a ${p.mult}× ATR multiplier. Entry direction follows a flip in the line.`, `The 200 EMA confirmation filter is ${p.trendFilter === 1 ? 'on' : 'off'} in the alert scanner.`, 'Strategy exit: Supertrend flips against the position.'],
    donchian: () => [`Daily close above the highest high of the previous ${p.entryLen} days for longs; below the lowest low for shorts.`, `Strategy exit: close below the lowest low of the previous ${p.exitLen} days for longs; above the highest high for shorts.`],
    scalpers: () => [`Confirmed ${settings.timeframe}-minute candles; entry bars from ${settings.entryStart} to before ${settings.entryEnd} ET.`, 'CALL direction when 9 EMA crosses above VWAP and the candle closes above VWAP; PUT direction mirrors this.', `Underlying stop beyond the signal candle by $0.02; minimum distance ${p.minStopPct}% and setups wider than ${p.maxStopPct}% are skipped.`, `Underlying target ${p.rMultiple} times the risk distance. Strategy exit: 9 EMA crosses back through VWAP.`, `The paper bot allows at most ${settings.maxTradesPerDay} daily entries and requests flattening at ${settings.flatAt} ET; these bot limits do not cap read-only alert counts.`],
  };
  const summaries: Record<string, () => string> = {
    orb: () => 'Marks the high and low of the 9:30–9:45 AM ET opening range and trades the first close beyond them.',
    donchian: () => `Daily ${p.entryLen}-day channel breakout with a ${p.exitLen}-day channel exit.`,
  };
  return { ...base, summary: summaries[id]?.() ?? base.summary, rules: rules[id]?.() ?? base.rules };
}
function etTime(minutes: number) { return `${Math.floor(minutes / 60).toString().padStart(2, '0')}:${(minutes % 60).toString().padStart(2, '0')}`; }
export const SCAN_UNIVERSE_DESCRIPTION = 'Automatic alerts evaluate SPY, IWM and QQQ plus the current ten largest US companies by market capitalization that are Alpaca-tradable. The company ranking refreshes daily; if refresh fails, the last verified list is retained. You can add custom tickers in the member area. Subscribers selecting the same ticker and rules receive the same rule-based setup, not a personal recommendation.';