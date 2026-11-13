import { iwmAlpaca } from './iwm-alpaca.server';
import { canReceiveStrategyAlerts } from '@/lib/strategy-platform';
import { defaultPulseConfig, evaluatePulseBars } from '@/lib/pulse-bots/config';
import { resolveBotSettings } from '@/lib/pulse-bots/risk';
import { etParts, addIndicators } from '@/lib/iwmWindowStrategy';
import { crossEntry } from '@/lib/iwm-trade-policy';
import { iwmConfigFor } from '@/lib/iwm-config';
import { closedRegularBars } from '@/lib/iwm-engine-rules';

import { alertPreferencesSchema, defaultAlertPreferences, scanSelections } from '@/lib/alert-preferences';
import { loadScanUniverse } from './scan-universe.server';

type Rec = Record<string, any>;
/** Read-only strategy evaluation. Never calls submit, cancel, or changes bot state. */
export async function runStrategyAlerts(overrides?: {db:any; apiFor:typeof iwmAlpaca}) {
  const db = overrides?.db ?? (await import('@/integrations/supabase/client.server')).supabaseAdmin;
  const apiFor = overrides?.apiFor ?? iwmAlpaca;
  const owners = await db.from('connections').select('user_id').eq('provider','alpaca');
  if (owners.error) throw new Error('Could not load alert connections');
  let alerts = 0, errors = 0, users = 0;
  const started = Date.now();
  for (const userId of new Set<string>((owners.data ?? []).map((r:Rec)=>r.user_id))) {
    if (Date.now()-started>38000) break;
    try {
      const tier = await db.rpc('plan_tier',{_user_id:userId});
      if (tier.error || !canReceiveStrategyAlerts(tier.data)) continue;
      const [iwm, prefs] = await Promise.all([
        db.from('iwm_strategy_settings').select('*').eq('user_id',userId).maybeSingle(),
        db.from('strategy_alert_preferences').select('*').eq('user_id',userId).maybeSingle(),
      ]);
      if (iwm.error || prefs.error) throw new Error('Could not read alert settings');
      const env = iwm.data?.trading_env==='live' ? 'live' : 'paper';
      const api = await apiFor(db,userId,undefined,env);
      const clock = await api.clock();
      if (!clock.is_open) continue;
      const now = new Date(clock.timestamp), today = etParts(now.toISOString()).date;
      const feed = iwm.data?.data_feed ?? 'iex';
      const universe = await loadScanUniverse(db,api,now);
      const preferences = prefs.data ? alertPreferencesSchema.parse(prefs.data) : defaultAlertPreferences();
      const selections = scanSelections(preferences,universe.symbols);
      const cfg = iwmConfigFor(iwm.data ?? {starting_bankroll:200,bank_trigger:25200});
      const checks = selections.map(selection=>{
        if(selection.strategy_id==='iwm') return {...selection,settings:null,timeframe:cfg.timeframeMin};
        const config=defaultPulseConfig(selection.strategy_id as Parameters<typeof defaultPulseConfig>[0]);
        const settings=resolveBotSettings(config,{isPaper:true});
        return {...selection,settings,timeframe:settings.timeframe};
      });
      const groups = new Map<number,string[]>();
      for(const c of checks) groups.set(c.timeframe,[...new Set([...(groups.get(c.timeframe)??[]),c.symbol])]);
      // One paginated request series per timeframe, not per strategy/symbol.
      const cache = new Map<number,Record<string,Rec[]>>();
      await Promise.all([...groups].map(async([timeframe,symbols])=>{
        const history:Record<string,Rec[]>={}; let token:string|undefined;
        for(let page=0;page<30;page++) {
          if(Date.now()-started>38000) throw new Error('Alert scan budget exceeded');
          const params=new URLSearchParams({symbols:symbols.join(','),timeframe:timeframe===1440?'1Day':`${timeframe}Min`,start:new Date(now.getTime()-(timeframe===1440?750:timeframe<=5?3:14)*86400000).toISOString(),end:now.toISOString(),feed,adjustment:'raw',limit:'10000',sort:'desc',...(token?{page_token:token}:{})});
          const r=await api.call(`/v2/stocks/bars?${params}`,'GET',undefined,true);
          for(const [symbol,bars] of Object.entries(r.bars??{})) history[symbol]=[...(history[symbol]??[]),...bars as Rec[]];
          token=r.next_page_token; if(!token) break;
        }
        if(token) throw new Error('Alert history incomplete');
        for(const symbol of symbols) history[symbol]=(history[symbol]??[]).filter(b=>timeframe===1440?etParts(b.t).date<today:etParts(b.t).minutes>=570&&etParts(b.t).minutes<960&&Date.parse(b.t)+timeframe*60000<=now.getTime()).sort((a,b)=>Date.parse(a.t)-Date.parse(b.t));
        cache.set(timeframe,history);
      }));
      const rows:Rec[]=[];
      for(const check of checks) {
        const {symbol,strategy_id,settings,timeframe,direction}=check;
        const history=cache.get(timeframe)?.[symbol]??[];
        const bars=strategy_id==='iwm'?closedRegularBars(history as any,now,cfg):history;
        const bar=bars.at(-1);
        if(!bar || timeframe!==1440&&(etParts(bar.t).date!==today||now.getTime()-Date.parse(bar.t)>timeframe*60000+90000)) continue;
        if(strategy_id==='iwm') {
          const ind=addIndicators(bars as any,cfg).at(-1);
          if(ind) for(const sig of crossEntry(ind,new Set(),cfg)) {
            const side=sig.side==='CALL'?'long':'short';
            if(direction!=='both'&&direction!==side) continue;
            rows.push({user_id:userId,strategy_id,symbol,side,bar_time:sig.barTime,price:sig.price,reason:sig.detail,timeframe_min:timeframe,data_feed:feed,environment:env});
          }
        } else if(settings) {
          const sig=evaluatePulseBars(bars as any,settings,new Set());
          if(!sig.entry || direction!=='both'&&direction!==sig.entry.side) continue;
          rows.push({user_id:userId,strategy_id,symbol,side:sig.entry.side,bar_time:bar.t,price:bar.c,reason:sig.entry.reason,timeframe_min:timeframe,data_feed:feed,environment:env});
        }
      }
      const uniqueRows = [...new Map(rows.map(row=>[`${row.strategy_id}|${row.symbol}|${row.bar_time}|${row.side}`,row])).values()];
      if(uniqueRows.length) {
        const saved = await db.from('strategy_alerts').upsert(uniqueRows,{onConflict:'user_id,strategy_id,symbol,bar_time,side',ignoreDuplicates:true}).select('id');
        if(saved.error) throw new Error('Could not save strategy alerts');
        alerts += saved.data?.length??0;
      }
      users++;
    } catch { errors++; console.error('Strategy alert check failed; no orders sent'); }
  }
  return {users,alerts,errors};
}