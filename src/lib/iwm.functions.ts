import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { DEFAULT_CONFIG } from "@/lib/iwmWindowStrategy";
import { iwmSettingsInput } from "@/lib/iwm-screen-rules";
import { IWM_TIMEFRAME_MIN } from '@/lib/iwm-config';

export const getIwmScreen = createServerFn({method:"POST"})
  .middleware([requireSupabaseAuth])
  .handler(async({context})=> {
    const db = context.supabase;
    const settings = await db.from("iwm_strategy_settings").select("*").eq("user_id", context.userId).maybeSingle();
    if (settings.error) throw new Error("Could not read IWM settings");
    const [state,signals,trades,protection,banks,reports] = await Promise.all([
      db.from("iwm_strategy_state").select("*").eq("user_id",context.userId).maybeSingle(),
      db.from("iwm_signals").select("*").eq("user_id",context.userId).order("created_at",{ascending:false}).limit(200),
      db.from("iwm_trades").select("*").eq("user_id",context.userId).order("entry_time",{ascending:false}).limit(200),
      db.from("iwm_protection_events").select("*").eq("user_id",context.userId).order("created_at",{ascending:false}).limit(500),
      db.from("iwm_bank_events").select("*").eq("user_id",context.userId).order("created_at",{ascending:false}).limit(200),
      db.from("iwm_daily_reports").select("*").eq("user_id",context.userId).order("day",{ascending:false}).limit(200),
    ]);
    if ([state,signals,trades,protection,banks,reports].some(r=>r.error)) throw new Error("Could not read the IWM journal");
    return {settings:settings.data, state:state.data, signals:signals.data ?? [],trades:trades.data ?? [],protection:protection.data ?? [],banks:banks.data ?? [],reports:reports.data ?? []};
  });

export const saveIwmSettings = createServerFn({method:"POST"})
  .middleware([requireSupabaseAuth])
  .inputValidator(input=>iwmSettingsInput.parse(input))
  .handler(async({data,context})=> {
    // Kill switch always stops new entries; the runner exits any open bot position.
    if (data.kill_switch) data.enabled=false;
    if (data.enabled) data.kill_switch=false;
    if (data.enabled) {
      const {iwmAlpaca} = await import("@/lib/server/iwm-alpaca.server");
      const {supabaseAdmin} = await import("@/integrations/supabase/client.server");
      const api = await iwmAlpaca(supabaseAdmin,context.userId);
      const account = await api.account();
      if (Number(account.options_trading_level ?? 0)<2 || account.trading_blocked) throw new Error("Paper account must allow buying options before enabling IWM");
    }
    const existing = await context.supabase.from("iwm_strategy_settings").select("user_id").eq("user_id",context.userId).maybeSingle();
    if(existing.error) throw new Error("Could not read IWM settings");
    const result = existing.data
      ? await context.supabase.from("iwm_strategy_settings").update(data).eq("user_id",context.userId).select("*").single()
      : await context.supabase.from("iwm_strategy_settings").insert({user_id:context.userId,...data}).select("*").single();
    if(result.error) throw new Error("Could not save IWM settings");
    return result.data;
  });

/** Read-only broker verification; never submits an order or enables automation. */
export const verifyIwmConnection = createServerFn({method:"POST"})
  .middleware([requireSupabaseAuth])
  .handler(async({context})=> {
    const {iwmAlpaca} = await import("@/lib/server/iwm-alpaca.server");
    const {supabaseAdmin} = await import("@/integrations/supabase/client.server");
    const api=await iwmAlpaca(supabaseAdmin,context.userId);
    return api.verify({...DEFAULT_CONFIG,timeframeMin:IWM_TIMEFRAME_MIN},"iex","indicative");
  });

/** Initialize disabled defaults and exercise a market-closed run without any broker order. */
export const initializeIwmEngine = createServerFn({method:"POST"})
  .middleware([requireSupabaseAuth])
  .handler(async({context})=> {
    const {iwmAlpaca}=await import("@/lib/server/iwm-alpaca.server");
    const {runIwmUser}=await import("@/lib/server/iwm-engine.server");
    const {supabaseAdmin}=await import("@/integrations/supabase/client.server");
    const api=await iwmAlpaca(supabaseAdmin,context.userId);
    const clock=await api.clock();
    if(clock.is_open) throw new Error("Read-only initialization check requires the market to be closed");
    const existing=await context.supabase.from("iwm_strategy_settings").select("*").eq("user_id",context.userId).maybeSingle();
    if(existing.error) throw new Error("Could not read IWM settings");
    let settings=existing.data;
    if(!settings) {
      const created=await context.supabase.from("iwm_strategy_settings").insert({user_id:context.userId,enabled:false}).select("*").single();
      if(created.error) throw new Error("Could not initialize disabled IWM settings");
      settings=created.data;
    }
    const state=await context.supabase.from("iwm_strategy_state").select("open_trade,pending_order").eq("user_id",context.userId).maybeSingle();
    if(state.error || state.data?.open_trade || state.data?.pending_order) throw new Error("Read-only initialization cannot run with an active position or order");
    return runIwmUser(supabaseAdmin,{...settings,enabled:false},api);
  });
/** User confirms a broker mismatch was resolved so the bot may open new trades again. */
export const acknowledgeIwmReview = createServerFn({method:"POST"})
  .middleware([requireSupabaseAuth])
  .handler(async({context})=> {
    const {supabaseAdmin}=await import("@/integrations/supabase/client.server");
    const {error}=await supabaseAdmin.from("iwm_strategy_state").update({needs_review:null}).eq("user_id",context.userId);
    if(error) throw new Error("Could not clear the review flag");
    return {ok:true};
  });
