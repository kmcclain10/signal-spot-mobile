import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { DEFAULT_CONFIG } from "@/lib/iwmWindowStrategy";

/** Read-only broker verification; never submits an order or enables automation. */
export const verifyIwmConnection = createServerFn({method:"POST"})
  .middleware([requireSupabaseAuth])
  .handler(async({context})=> {
    const {iwmAlpaca} = await import("@/lib/server/iwm-alpaca.server");
    const {supabaseAdmin} = await import("@/integrations/supabase/client.server");
    const api=await iwmAlpaca(supabaseAdmin,context.userId);
    return api.verify(DEFAULT_CONFIG,"iex","indicative");
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