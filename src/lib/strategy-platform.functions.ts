import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { mergeRealSignals, type RealSignal, type RealTrade } from './strategy-platform';

type Rec = Record<string,any>;
const numeric = (v:unknown) => v!==null && v!==undefined && Number.isFinite(Number(v)) ? Number(v) : null;

export const getStrategyPlatform = createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).handler(async({context})=>{
  const db = context.supabase, uid = context.userId;
  const [alerts,signals,trades,bots,states,events,settings,state] = await Promise.all([
    db.from('strategy_alerts').select('*').eq('user_id',uid).order('created_at',{ascending:false}).limit(500),
    db.from('iwm_signals').select('*').eq('user_id',uid).eq('kind','entry').order('bar_time',{ascending:false}).limit(500),
    db.from('iwm_trades').select('*').eq('user_id',uid).order('entry_time',{ascending:false}).limit(500),
    db.from('pulse_bot_configs').select('id,config,enabled,kill_switch').eq('user_id',uid),
    db.from('pulse_bot_states').select('bot_id,state').eq('user_id',uid),
    db.from('pulse_bot_events').select('*').eq('user_id',uid).in('kind',['signal','entry','exit']).order('created_at',{ascending:false}).limit(500),
    db.from('iwm_strategy_settings').select('*').eq('user_id',uid).maybeSingle(),
    db.from('iwm_strategy_state').select('*').eq('user_id',uid).maybeSingle(),
  ]);
  if([alerts,signals,trades,bots,states,events,settings,state].some(r=>r.error)) throw new Error('Could not load real strategy activity');
  const botMap = new Map((bots.data??[]).map(b=>[b.id,b.config as Rec]));
  const real: RealSignal[] = (alerts.data??[]).map(a=>({id:a.id,strategy:a.strategy_id,symbol:a.symbol,side:a.side,at:a.created_at,barTime:a.bar_time,price:numeric(a.price),reason:a.reason,status:'alert',environment:a.environment,feed:a.data_feed,contract:null,fill:null}));
  for(const s of signals.data??[]) {
    const filled = (trades.data??[]).find(t=>t.side===s.side && Date.parse(t.entry_time)>=Date.parse(s.bar_time) && Date.parse(t.entry_time)-Date.parse(s.bar_time)<450000);
    real.push({id:s.id,strategy:'iwm',symbol:'IWM',side:s.side==='CALL'?'long':'short',at:s.created_at,barTime:s.bar_time,price:numeric(s.price),reason:s.detail??'8/20 EMA cross',status:filled ? filled.exit_time?'closed':'filled' : s.action??'evaluating',environment:'unrecorded',feed:'Engine feed',contract:filled?.option_symbol??null,fill:filled?numeric(filled.entry_premium):null});
  }
  for(const e of events.data??[]) {
    const c=botMap.get(e.bot_id), d=e.detail as Rec;
    if((!c && !d.strategyId) || e.kind==='exit') continue;
    const symbol = /^[A-Z.]+\d{6}[CP]\d{8}$/.test(d.symbol??'') ? String(d.symbol).slice(0,-15) : String(d.symbol??'');
    real.push({id:e.id,strategy:d.strategyId??c?.strategyId,symbol,side:d.side??'long',at:e.created_at,barTime:d.barTime??e.created_at,price:e.kind==='signal'?numeric(d.price):null,reason:d.reason??'Strategy entry',status:e.kind==='entry'?'filled':'alert',environment:'paper',feed:'IEX / indicative',contract:e.kind==='entry' && d.symbol!==symbol ? d.symbol:null,fill:e.kind==='entry'?numeric(d.price):null});
  }
  return {signals:mergeRealSignals(real),bots:bots.data??[],states:states.data??[],settings:settings.data,state:state.data};
});

/** Complete owner history is paginated; no legacy reports or simulated returns. */
export const getRealPerformance = createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).handler(async({context})=>{
  const db=context.supabase, uid=context.userId;
  const bots = await db.from('pulse_bot_configs').select('id,config').eq('user_id',uid);
  if(bots.error) throw new Error('Could not load strategies');
  const botMap = new Map((bots.data??[]).map(b=>[b.id,(b.config as Rec).strategyId]));
  const result: RealTrade[]=[];
  for(let offset=0;;offset+=1000) {
    const r=await db.from('iwm_trades').select('*').eq('user_id',uid).not('exit_time','is',null).order('entry_time').order('id').range(offset,offset+999);
    if(r.error) throw new Error('Could not load IWM fills');
    for(const t of r.data??[]) if(t.exit_time && numeric(t.pnl)!==null) result.push({id:t.id,strategy:'iwm',symbol:t.option_symbol,at:t.exit_time,entryAt:t.entry_time,pnl:Number(t.pnl),environment:'unrecorded',reason:t.exit_reason??'Closed'});
    if((r.data?.length??0)<1000) break;
  }
  const entries = new Map<string,string>();
  for(let offset=0;;offset+=1000) {
    const r=await db.from('pulse_bot_events').select('*').eq('user_id',uid).in('kind',['entry','exit']).order('created_at').order('id').range(offset,offset+999);
    if(r.error) throw new Error('Could not load bot fills');
    for(const e of r.data??[]) {
      const d=e.detail as Rec, key=`${e.bot_id}|${d.symbol}`;
      if(e.kind==='entry') {entries.set(key,e.created_at);continue;}
      if(numeric(d.pnl)===null) continue;
      result.push({id:e.id,strategy:d.strategyId??botMap.get(e.bot_id)??'removed-bot',symbol:String(d.symbol??''),at:e.created_at,entryAt:d.entryAt??entries.get(key)??null,pnl:Number(d.pnl),environment:'paper',reason:d.reason??'Closed'});
    }
    if((r.data?.length??0)<1000) break;
  }
  return {trades:result};
});