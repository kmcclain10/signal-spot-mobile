import { iwmAlpaca } from './iwm-alpaca.server';
import { defaultAlertSettings, canReceiveStrategyAlerts } from '@/lib/strategy-platform';
import { pulseConfigSchema, evaluatePulseBars } from '@/lib/pulse-bots/config';
import { resolveBotSettings } from '@/lib/pulse-bots/risk';
import { etParts, addIndicators } from '@/lib/iwmWindowStrategy';
import { crossEntry } from '@/lib/iwm-trade-policy';
import { iwmConfigFor } from '@/lib/iwm-config';
import { closedRegularBars } from '@/lib/iwm-engine-rules';

type Rec = Record<string, any>;
/** Read-only strategy evaluation. Never calls submit, cancel, or changes bot state. */
export async function runStrategyAlerts() {
  const { supabaseAdmin: db } = await import('@/integrations/supabase/client.server');
  const owners = await db.from('connections').select('user_id').eq('provider','alpaca');
  if (owners.error) throw new Error('Could not load alert connections');
  let alerts = 0, errors = 0, users = 0;
  const started = Date.now();
  for (const userId of new Set((owners.data ?? []).map(r=>r.user_id))) {
    if (Date.now()-started>38000) break;
    try {
      const tier = await db.rpc('plan_tier',{_user_id:userId});
      if (tier.error || !canReceiveStrategyAlerts(tier.data)) continue;
      const [iwm, bots] = await Promise.all([
        db.from('iwm_strategy_settings').select('*').eq('user_id',userId).maybeSingle(),
        db.from('pulse_bot_configs').select('config').eq('user_id',userId),
      ]);
      if (iwm.error || bots.error) throw new Error('Could not read alert settings');
      const env = iwm.data?.trading_env==='live' ? 'live' : 'paper';
      const api = await iwmAlpaca(db,userId,undefined,env);
      const clock = await api.clock();
      if (!clock.is_open) continue;
      const now = new Date(clock.timestamp), today = etParts(now.toISOString()).date;
      const feed = iwm.data?.data_feed ?? 'iex';
      const configs = (bots.data ?? []).flatMap(row => {
        const parsed = pulseConfigSchema.safeParse(row.config);
        return parsed.success ? [{ config: parsed.data, settings: resolveBotSettings(parsed.data,{isPaper:true}) }] : [];
      });
      const configured = new Set(configs.map(c=>c.config.strategyId));
      const checks = [...configs,...defaultAlertSettings().filter(c=>!configured.has(c.config.strategyId as any))];
      const cache = new Map<string,Promise<Rec[]>>();
      async function barsFor(symbol:string, timeframe:number) {
        const key = `${symbol}|${timeframe}`;
        let promise = cache.get(key);
        if (!promise) {
          promise = (async()=>{
            let token: string | undefined; const bars: Rec[] = [];
            for(let page=0;page<5;page++) {
              const params = new URLSearchParams({symbols:symbol,timeframe:timeframe===1440?'1Day':`${timeframe}Min`,start:new Date(now.getTime()-(timeframe===1440?750:14)*86400000).toISOString(),end:now.toISOString(),feed,adjustment:'raw',limit:'10000',sort:'desc',...(token?{page_token:token}:{})});
              const r = await api.call(`/v2/stocks/bars?${params}`,'GET',undefined,true);
              bars.push(...(r.bars?.[symbol]??[])); token=r.next_page_token;
              if(!token) break;
            }
            if(token) throw new Error('Alert history incomplete');
            return bars.filter(b=>timeframe===1440 ? etParts(b.t).date<today : etParts(b.t).minutes>=570 && etParts(b.t).minutes<960 && Date.parse(b.t)+timeframe*60000<=now.getTime()).reverse();
          })();
          cache.set(key,promise);
        }
        return promise;
      }
      const rows: Rec[] = [];
      const cfg = iwmConfigFor(iwm.data ?? {starting_bankroll:200,bank_trigger:25200});
      const iwmBars = closedRegularBars(await barsFor('IWM',cfg.timeframeMin) as any,now,cfg);
      const last = iwmBars.at(-1);
      if(last && etParts(last.t).date===today && now.getTime()-Date.parse(last.t)<=cfg.timeframeMin*60000+90000) {
        const ind = addIndicators(iwmBars,cfg).at(-1);
        if(ind) for(const sig of crossEntry(ind,new Set(),cfg)) rows.push({user_id:userId,strategy_id:'iwm',symbol:'IWM',side:sig.side==='CALL'?'long':'short',bar_time:sig.barTime,price:sig.price,reason:sig.detail,timeframe_min:cfg.timeframeMin,data_feed:feed,environment:env});
      }
      for(const {config,settings} of checks) for(const symbol of config.symbols) {
        if(Date.now()-started>42000) break;
        const bars = await barsFor(symbol,settings.timeframe), bar = bars.at(-1);
        if(!bar || settings.timeframe!==1440 && (etParts(bar.t).date!==today || now.getTime()-Date.parse(bar.t)>settings.timeframe*120000)) continue;
        const sig = evaluatePulseBars(bars as any,settings,new Set());
        if(!sig.entry || config.direction!=='both' && config.direction!==sig.entry.side) continue;
        rows.push({user_id:userId,strategy_id:config.strategyId,symbol,side:sig.entry.side,bar_time:bar.t,price:bar.c,reason:sig.entry.reason,timeframe_min:settings.timeframe,data_feed:feed,environment:env});
      }
      if(rows.length) {
        const saved = await db.from('strategy_alerts').upsert(rows as any,{onConflict:'user_id,strategy_id,symbol,bar_time,side',ignoreDuplicates:true}).select('id');
        if(saved.error) throw new Error('Could not save strategy alerts');
        alerts += saved.data?.length??0;
      }
      users++;
    } catch { errors++; console.error('Strategy alert check failed; no orders sent'); }
  }
  return {users,alerts,errors};
}