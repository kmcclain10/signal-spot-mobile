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
  return {preferences:prefs.data?alertPreferencesSchema.parse(prefs.data):defaultAlertPreferences(),universe:universe.data,allowed:canReceiveStrategyAlerts(tier.data)};
});
export const saveAlertPreferences = createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((input:unknown)=>alertPreferencesSchema.parse(input)).handler(async({data,context})=>{
  const db=context.supabase;
  const tier=await db.rpc('plan_tier',{_user_id:context.userId});
  if(tier.error||!canReceiveStrategyAlerts(tier.data)) throw new Error('An Alerts or AI Bots plan is required');
  const r=await db.from('strategy_alert_preferences').upsert({...data,user_id:context.userId,updated_at:new Date().toISOString()});
  if(r.error) throw new Error('Could not save alert selections');
  return {saved:true};
});