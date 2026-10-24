export const isBotOrder=(id:unknown)=>/^(iwm-|pulse-)/.test(String(id??""));
export const underlyingOf=(symbol:string)=>symbol.replace(/\d{6}[CP]\d{8}$/,"");
export async function assertNoPulseOwnership(db:any,userId:string,symbol:string){
  const [configs,states]=await Promise.all([db.from("pulse_bot_configs").select("enabled,config").eq("user_id",userId),db.from("pulse_bot_states").select("state").eq("user_id",userId)]);
  if(configs.error||states.error) throw new Error("Could not verify bot ownership; order not sent");
  const underlying=underlyingOf(symbol);
  if((configs.data??[]).some((c:any)=>c.enabled && c.config?.symbols?.includes(underlying)) || (states.data??[]).some((r:any)=>r.state?.position?.underlying===underlying||r.state?.pending?.position?.underlying===underlying||r.state?.pending?.body?.symbol===symbol)) throw new Error("A separate bot manages this underlying. Stop and flatten it in Bots before manual trading.");
}