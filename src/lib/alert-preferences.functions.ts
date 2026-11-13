import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { alertPreferencesSchema, defaultAlertPreferences } from './alert-preferences';
import { canReceiveStrategyAlerts } from './strategy-platform';

export const getAlertPreferences = createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).handler(async({context})=>{
  const db=context.supabase;
  const [prefs,universe,tier]=await Promise.all([
    db.from('strategy_alert_preferences').select('*').eq('user_id',context.userId).maybeSingle(),
    db.from('strategy_scan_universe').select('*').eq('id','us_market_cap').maybeSingle(),
    db.rpc('plan_tier',{_user_id:context.userId}),
  ]);
  if(prefs.error||universe.error||tier.error) throw new Error('Could not load alert selections');
  let markets=universe.data;
  if(canReceiveStrategyAlerts(tier.data)&&(!markets||Date.now()-Date.parse(markets.refreshed_at)>=86400000)) {
    try {
      const [{iwmAlpaca},{loadScanUniverse},{supabaseAdmin}]=await Promise.all([import('./server/iwm-alpaca.server'),import('./server/scan-universe.server'),import('@/integrations/supabase/client.server')]);
      const settings=await db.from('iwm_strategy_settings').select('trading_env').eq('user_id',context.userId).maybeSingle();
      const api=await iwmAlpaca(db,context.userId,undefined,settings.data?.trading_env==='live'?'live':'paper');
      // Shared public ranking refresh is privileged; credentials remain owner-scoped.
      markets=await loadScanUniverse(supabaseAdmin,api,new Date());
    } catch { /* Show missing or last verified ranking rather than imaginary data. */ }
  }
  return {preferences:prefs.data?alertPreferencesSchema.parse(prefs.data):defaultAlertPreferences(),universe:markets,allowed:canReceiveStrategyAlerts(tier.data)};
});
export const saveAlertPreferences = createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((input:unknown)=>alertPreferencesSchema.parse(input)).handler(async({data,context})=>{
  const db=context.supabase;
  const tier=await db.rpc('plan_tier',{_user_id:context.userId});
  if(tier.error||!canReceiveStrategyAlerts(tier.data)) throw new Error('An Alerts or AI Bots plan is required');
  const r=await db.from('strategy_alert_preferences').upsert({...data,user_id:context.userId,updated_at:new Date().toISOString()});
  if(r.error) throw new Error('Could not save alert selections');
  return {saved:true};
});