import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { pulseConfigSchema } from "@/lib/pulse-bots/config";
import { resolveBotSettings } from "@/lib/pulse-bots";
import type { Json } from "@/integrations/supabase/types";

export const getPulseBots=createServerFn({method:"POST"}).middleware([requireSupabaseAuth]).handler(async({context})=>{
  const [bots,states,events]=await Promise.all([
    context.supabase.from("pulse_bot_configs").select("*").eq("user_id",context.userId).order("created_at"),
    context.supabase.from("pulse_bot_states").select("*").eq("user_id",context.userId),
    context.supabase.from("pulse_bot_events").select("*").eq("user_id",context.userId).order("created_at",{ascending:false}).limit(100),
  ]);
  if(bots.error||states.error||events.error) throw new Error("Could not load separate bots");
  return {bots:bots.data??[],states:states.data??[],events:events.data??[]};
});

export const savePulseBot=createServerFn({method:"POST"}).middleware([requireSupabaseAuth]).inputValidator(z.object({id:z.string().uuid().optional(),config:pulseConfigSchema})).handler(async({data,context})=>{
  resolveBotSettings(data.config,{isPaper:true});
  const {data:fresh,error:authError}=await context.supabase.rpc("has_recent_password_auth");
  if(authError||!fresh) throw new Error("Confirm your password before configuring a bot");
  const {iwmAlpaca}=await import("@/lib/server/iwm-alpaca.server");
  const api=await iwmAlpaca(context.supabase,context.userId);
  const account=await api.account();
  if(account.trading_blocked || account.account_blocked) throw new Error("Paper account is blocked from trading");
  if(data.config.instrument==="options" && Number(account.options_trading_level)<2) throw new Error("Paper account needs options level 2");
  const peers=await context.supabase.from("pulse_bot_configs").select("id,config,enabled").eq("user_id",context.userId);
  if(peers.error) throw new Error("Could not verify bot allocations");
  if(!data.id && (peers.data?.length??0)>=9) throw new Error("Maximum nine separate bots per account");
  const allocated=(peers.data??[]).filter(b=>b.id!==data.id).reduce((sum,b)=>sum+Number((b.config as Record<string,any>).allocation??0),0);
  if(allocated+data.config.allocation>Number(account.equity)) throw new Error("Combined bot allocations exceed paper account equity");
  for(const symbol of data.config.symbols){
    const asset=await api.call(`/v2/assets/${encodeURIComponent(symbol)}`);
    if(!asset.tradable || asset.status!=="active") throw new Error(`${symbol} is not tradable`);
    if(data.config.instrument==="shares" && data.config.direction!=="long" && !asset.shortable) throw new Error(`${symbol} cannot be shorted on this account`);
  }
  const row={config:data.config as unknown as Json,enabled:data.config.enabled};
  const result=data.id ? await context.supabase.from("pulse_bot_configs").update(row).eq("id",data.id).eq("user_id",context.userId).select("id").single() : await context.supabase.from("pulse_bot_configs").insert({...row,user_id:context.userId}).select("id").single();
  if(result.error) throw new Error(result.error.message);
  return result.data;
});

export const controlPulseBot=createServerFn({method:"POST"}).middleware([requireSupabaseAuth]).inputValidator(z.object({id:z.string().uuid(),action:z.enum(["enable","stop","kill","delete"])})).handler(async({data,context})=>{
  if(data.action==="delete"){
    const r=await context.supabase.from("pulse_bot_configs").delete().eq("id",data.id).eq("user_id",context.userId);
    if(r.error) throw new Error(r.error.message); return {ok:true};
  }
  const r=await context.supabase.from("pulse_bot_configs").update(data.action==="enable"?{enabled:true,kill_switch:false}:{enabled:false,kill_switch:data.action==="kill"}).eq("id",data.id).eq("user_id",context.userId).select("id").single();
  if(r.error) throw new Error(r.error.message); return {ok:true};
});