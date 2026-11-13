import { STRATEGIES } from '@/lib/pulse-bots/strategies';
import { separateStrategyIds, defaultPulseConfig } from '@/lib/pulse-bots/config';
import { resolveBotSettings } from '@/lib/pulse-bots/risk';
import { IWM_TIMEFRAME_MIN } from '@/lib/iwm-config';
import { IWM_TRAIL_START_PCT, IWM_TRAIL_PTS, IWM_MAX_TARGET_PCT } from '@/lib/iwm-trade-policy';

export const PLAYBOOK = [
  { id: 'iwm', name: 'IWM 8/20 Momentum', category: 'Momentum', timeframe: IWM_TIMEFRAME_MIN,
    summary: 'At-the-money options on a confirmed 8/20 EMA cross.',
    rules: ['CALL on the bullish cross; PUT on the bearish cross.', '5-minute closed candles from 9:30 AM ET. Entry cutoff 3:00 PM ET.', 'Size at half the current strategy balance. No stop loss or time limit.', `Trailer arms at +${IWM_TRAIL_START_PCT}%; sells all ${IWM_TRAIL_PTS} percentage points below the best gain. +${IWM_MAX_TARGET_PCT}% cap.`, 'Opposite cross: close and flip. Force liquidation at 3:40 PM ET, earlier on shortened sessions.', 'Half of each winning trade’s profit goes toward WMT.'],
    symbol: 'IWM', environment: 'selected',
  },
  ...STRATEGIES.filter(s => separateStrategyIds.some(id => id === s.id)).map(s => ({
    id: s.id, name: s.botName, category: s.category, timeframe: s.defaultTimeframe,
    summary: s.summary, rules: s.rules, symbol: defaultPulseConfig(s.id).symbols.join(', '), environment: 'paper',
  })),
];

export const strategyLabel = (id: string) => PLAYBOOK.find(s => s.id === id)?.name ?? id;
export const canReceiveStrategyAlerts = (tier: unknown) => tier === 'alerts' || tier === 'bots';
export const defaultAlertSettings = () => separateStrategyIds.map(id => {
  const config = defaultPulseConfig(id);
  return { config, settings: resolveBotSettings(config, { isPaper: true }) };
});

export type RealSignal = {
  id: string; strategy: string; symbol: string; side: string; at: string; barTime: string;
  price: number | null; reason: string; status: string; environment: string;
  feed: string; contract: string | null; fill: number | null;
};
export type RealTrade = {
  id: string; strategy: string; symbol: string; at: string; entryAt: string | null;
  pnl: number; environment: string; reason: string;
};
export function performanceStats(trades: RealTrade[]) {
  const sorted = [...trades].sort((a,b) => Date.parse(a.at)-Date.parse(b.at));
  let cumulative = 0, peak = 0, drawdown = 0;
  const equity = sorted.map(t => {
    cumulative += t.pnl; peak = Math.max(peak,cumulative); drawdown = Math.max(drawdown,peak-cumulative);
    return { at: t.at, pnl: Math.round(cumulative*100)/100 };
  });
  const winners = sorted.filter(t => t.pnl>0), losers = sorted.filter(t => t.pnl<0);
  const grossProfit = winners.reduce((n,t) => n+t.pnl,0), grossLoss = -losers.reduce((n,t) => n+t.pnl,0);
  const durations = sorted.flatMap(t => t.entryAt && Date.parse(t.at)>=Date.parse(t.entryAt) ? [(Date.parse(t.at)-Date.parse(t.entryAt))/60000] : []);
  return { total: sorted.length, wins: winners.length, losses: losers.length,
    pnl: Math.round(cumulative*100)/100, winRate: sorted.length ? winners.length/sorted.length : null,
    profitFactor: grossLoss>0 ? grossProfit/grossLoss : null, noLosses: grossLoss===0 && grossProfit>0,
    averageHold: durations.length ? durations.reduce((n,v)=>n+v,0)/durations.length : null,
    drawdown, equity };
}

/** Scanner and runner records represent one setup, not two alerts. Filled records take precedence. */
export function mergeRealSignals(rows: RealSignal[]) {
  const map = new Map<string, RealSignal>();
  for (const row of rows) {
    const key = `${row.strategy}|${row.symbol}|${row.barTime}|${row.side}`;
    const old = map.get(key);
    if (!old || row.fill!==null || old.status==='alert' && row.status!=='alert') map.set(key,row);
  }
  return [...map.values()].sort((a,b)=>Date.parse(b.at)-Date.parse(a.at));
}