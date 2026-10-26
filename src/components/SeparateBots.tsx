import { useEffect, useState } from "react";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Settings2, Trash2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getPulseBots, savePulseBot, controlPulseBot } from "@/lib/pulse-bots.functions";
import { strategyCatalog, riskCatalog, resolveBotSettings, type BotConfig, type StrategyId, type Timeframe, type RiskLevel } from "@/lib/pulse-bots";
import { defaultPulseConfig, pulseConfigSchema } from "@/lib/pulse-bots/config";
import { useAccountConfirmation } from "./AccountSecurity";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Switch } from "./ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";

export const separateBotsOptions=queryOptions({queryKey:["separate-bots"],queryFn:()=>getPulseBots(),refetchInterval:30000});
const catalog=strategyCatalog().filter(s=>s.id!=="window20");
const cash=(v:unknown)=>Number(v??0).toLocaleString("en-US",{style:"currency",currency:"USD"});
const tf=(n:number)=>n===1440?"Daily":`${n} min`;
type Rec=Record<string,any>;

export function SeparateBots({userId}:{userId:string}){
  const {data}=useSuspenseQuery(separateBotsOptions),qc=useQueryClient();
  const confirm=useAccountConfirmation(),save=useServerFn(savePulseBot),control=useServerFn(controlPulseBot);
  const [draft,setDraft]=useState<BotConfig|null>(null),[editId,setEditId]=useState<string|undefined>(),[busy,setBusy]=useState(false);
  useEffect(()=>{
    const ch=supabase.channel(`separate-bots-${userId}`);
    for(const table of ["pulse_bot_configs","pulse_bot_states","pulse_bot_events"]) ch.on("postgres_changes",{event:"*",schema:"public",table,filter:`user_id=eq.${userId}`},()=>{qc.invalidateQueries({queryKey:separateBotsOptions.queryKey});});
    ch.subscribe();return ()=>{supabase.removeChannel(ch);};
  },[userId,qc]);
  const stateMap=new Map(data.states.map(s=>[s.bot_id,s.state as Rec]));
  async function act(id:string,action:"enable"|"stop"|"kill"|"delete"){
    if(action==="enable"&&!await confirm()) return;
    setBusy(true);try{await control({data:{id,action}});await qc.invalidateQueries({queryKey:separateBotsOptions.queryKey});toast.success(action==="enable"?"Paper bot enabled":action==="delete"?"Bot removed":"Bot will flatten on its next market check");}catch(e){toast.error(e instanceof Error?e.message:"Could not update bot");}finally{setBusy(false);}
  }
  function open(id?:string,config?:BotConfig){setEditId(id);setDraft(config??defaultPulseConfig("orb"));}
  async function persist(){
    if(!draft) return;
    const parsed=pulseConfigSchema.safeParse(draft);if(!parsed.success){toast.error(parsed.error.issues[0]?.message??"Check settings");return;}
    // Close the settings modal before opening shared confirmation so dialogs never overlap.
    const restore=draft;setDraft(null);
    if(!await confirm()){setDraft(restore);return;}
    setBusy(true);try{await save({data:{...(editId?{id:editId}:{}),config:parsed.data}});await qc.invalidateQueries({queryKey:separateBotsOptions.queryKey});toast.success("Paper bot saved");}catch(e){setDraft(restore);toast.error(e instanceof Error?e.message:"Could not save bot");}finally{setBusy(false);}
  }
  const selected=catalog.find(s=>s.id===draft?.strategyId);
  const resolved=draft?resolveBotSettings(draft,{isPaper:true}):null;
  function number(key:string,label:string,value:number,onChange:(n:number)=>void,min=0,max=100000,step=1){return <div className="space-y-1" key={key}><Label htmlFor={`pulse-${key}`}>{label}</Label><Input id={`pulse-${key}`} type="number" inputMode="decimal" min={min} max={max} step={step} value={Number.isFinite(value)?value:""} onChange={e=>onChange(Number(e.target.value))}/></div>;}
  const selectClass="h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm";
  return <section className="space-y-5 border-t pt-6">
    <div className="flex items-center justify-between gap-3"><h2 className="text-xl font-semibold">Separate bots</h2><Button variant="outline" size="sm" onClick={()=>open()} disabled={data.bots.length>=9}><Plus className="size-4"/>Add bot</Button></div>
    {!data.bots.length && <div className="grid gap-3 sm:grid-cols-2">{catalog.map(s=><div key={s.id} className="border-b py-3"><div className="flex items-center justify-between gap-2"><h3 className="font-semibold">{s.botName}</h3><Button variant="ghost" size="icon" aria-label={`Add ${s.botName}`} onClick={()=>open(undefined,defaultPulseConfig(s.id))}><Plus/></Button></div><p className="text-xs text-muted-foreground">{s.name} · {tf(s.defaultTimeframe)}</p></div>)}</div>}
    {data.bots.map(row=>{
      const cfg=row.config as unknown as BotConfig,st=stateMap.get(row.id)??{},strategy=catalog.find(s=>s.id===cfg.strategyId),active=!!st.position||!!st.pending;
      const events=data.events.filter(e=>e.bot_id===row.id).slice(0,4);
      return <article key={row.id} className="space-y-4 rounded-lg border bg-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h3 className="break-words font-semibold">{cfg.name??strategy?.botName}</h3><p className="mt-1 flex items-center gap-1 text-xs font-semibold text-gain"><ShieldCheck className="size-3"/>PAPER ONLY</p><p className="mt-1 text-xs text-muted-foreground">{cfg.symbols.join(", ")} · {tf(cfg.timeframe??5)} · {cfg.instrument} · {cfg.riskLevel}</p></div><Switch aria-label={`Enable ${cfg.name}`} disabled={busy} checked={row.enabled} onCheckedChange={v=>act(row.id,v?"enable":"stop")}/></div>
        <p className="text-sm">{st.review??st.note??(row.enabled?"Awaiting first check":"Disabled")}</p>
        <div className="grid grid-cols-3 gap-2 text-sm"><div><p className="text-xs text-muted-foreground">Allocation</p><p className="num">{cash(cfg.allocation)}</p></div><div><p className="text-xs text-muted-foreground">Balance</p><p className="num">{cash(st.balance??cfg.allocation)}</p></div><div><p className="text-xs text-muted-foreground">Banked</p><p className="num text-banked">{cash(st.bankedTotal)}</p></div></div>
        {st.position&&<div className="border-l-2 border-primary pl-3 text-sm"><p className="break-all font-medium">{st.position.symbol} · {st.position.qty} {cfg.instrument==="options"?"contracts":"shares"}</p><p className="num text-muted-foreground">Entry {cash(st.position.entryPrice)} · Mark {st.position.mark?cash(st.position.mark):"—"}</p>{st.position.floorPct!==null&&<p>Protected floor +{st.position.floorPct}%</p>}</div>}
        <div className="flex items-center gap-2"><Button variant="outline" size="sm" disabled={busy||active} onClick={()=>open(row.id,{...cfg,enabled:row.enabled})}><Settings2 className="size-4"/>Settings</Button><Button size="sm" variant="destructive" disabled={busy||row.kill_switch} onClick={()=>act(row.id,"kill")}>Stop & flatten</Button><Button variant="ghost" size="icon" aria-label={`Delete ${cfg.name}`} disabled={busy||active||row.enabled} onClick={()=>{if(window.confirm("Remove this stopped bot?")) act(row.id,"delete");}}><Trash2 className="size-4"/></Button></div>
        {st.lastCheck&&<p className="text-xs text-muted-foreground">Checked {new Date(st.lastCheck).toLocaleString()}</p>}
        {events.length>0&&<div className="border-t pt-2">{events.map(e=><p key={e.id} className="break-words py-1 text-xs text-muted-foreground">{new Date(e.created_at).toLocaleTimeString()} · {e.kind} · {String((e.detail as Rec).reason??(e.detail as Rec).message??(e.detail as Rec).symbol??cash((e.detail as Rec).amount))}</p>)}</div>}
      </article>;
    })}
    <Dialog open={!!draft} onOpenChange={v=>{if(!v) setDraft(null);}}><DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-xl"><DialogHeader><DialogTitle>{editId?"Bot settings":"Add paper bot"}</DialogTitle></DialogHeader>
      {draft&&selected&&resolved&&<div className="space-y-5">
        <div className="space-y-1"><Label htmlFor="pulse-strategy">Strategy</Label><select id="pulse-strategy" className={selectClass} disabled={!!editId} value={draft.strategyId} onChange={e=>setDraft(defaultPulseConfig(e.target.value as StrategyId))}>{catalog.map(s=><option key={s.id} value={s.id}>{s.botName}</option>)}</select></div>
        <div className="space-y-1"><Label htmlFor="pulse-name">Name</Label><Input id="pulse-name" value={draft.name??""} onChange={e=>setDraft({...draft,name:e.target.value})}/></div>
        <div className="space-y-1"><Label htmlFor="pulse-symbols">Symbols</Label><Input id="pulse-symbols" value={draft.symbols.join(",")} onChange={e=>setDraft({...draft,symbols:e.target.value.toUpperCase().split(",")})}/></div>
        <div className="grid grid-cols-2 gap-3"><div><Label htmlFor="pulse-timeframe">Chart</Label><select id="pulse-timeframe" className={selectClass} value={draft.timeframe} onChange={e=>setDraft({...draft,timeframe:Number(e.target.value) as Timeframe})}>{selected.timeframes.map(n=><option key={n} value={n}>{tf(n)}</option>)}</select></div><div><Label htmlFor="pulse-risk">Risk</Label><select id="pulse-risk" className={selectClass} value={draft.riskLevel} onChange={e=>setDraft({...draft,riskLevel:e.target.value as RiskLevel,params:undefined,overrides:undefined})}>{Object.entries(riskCatalog()).map(([id,r])=><option key={id} value={id}>{r.label}</option>)}</select></div></div>
        <div className="grid grid-cols-2 gap-3"><div><Label htmlFor="pulse-instrument">Instrument</Label><select id="pulse-instrument" className={selectClass} value={draft.instrument} onChange={e=>setDraft({...draft,instrument:e.target.value as "shares"|"options",overrides:undefined})}><option value="shares">Shares</option><option value="options">Options</option></select></div><div><Label htmlFor="pulse-direction">Direction</Label><select id="pulse-direction" className={selectClass} value={draft.direction} onChange={e=>setDraft({...draft,direction:e.target.value as BotConfig["direction"]})}><option value="long">Long / calls</option><option value="short">Short / puts</option><option value="both">Both</option></select></div></div>
        {number("allocation","Allocation ($)",draft.allocation,n=>setDraft({...draft,allocation:n}),1)}
        <div><Label htmlFor="pulse-mode">Execution</Label><select id="pulse-mode" className={selectClass} value={draft.executionMode} onChange={e=>setDraft({...draft,executionMode:e.target.value as BotConfig["executionMode"]})}><option value="auto">Automatic paper orders</option><option value="alerts">Alerts only</option><option value="confirm">Manual review signals</option></select></div>
        <div className="border-t pt-3"><h4 className="mb-2 font-medium">Strategy rules</h4><ul className="list-disc space-y-1 pl-4 text-xs text-muted-foreground">{selected.rules.map(r=><li key={r}>{r}</li>)}</ul></div>
        <div className="grid grid-cols-2 gap-3">{selected.params.map(p=>number(p.key,p.label,draft.params?.[p.key]??resolved.params[p.key],n=>setDraft({...draft,params:{...draft.params,[p.key]:n}}),p.min,p.max,p.step))}</div>
        <details><summary className="cursor-pointer font-medium">Risk & session</summary><div className="mt-3 grid grid-cols-2 gap-3">{([ ["sizePct","Trade size (%)"],["stopLossPct","Stop loss (%)"],["takeProfitPct","Take profit (%)"],["trailStartPct","Trail starts (%)"],["trailLockPct","First floor (%)"],["trailStepPct","Trail step (%)"],["maxTradesPerDay","Daily trade limit"],["dailyLossPct","Daily loss (%)"] ] as const).map(([key,label])=>number(key,label,resolved[key],n=>setDraft({...draft,overrides:{...draft.overrides,[key]:n}}),0,1000,0.1))}
        {([ ["entryStart","Entries from"],["entryEnd","Entries until"],["flatAt","Flatten at"] ] as const).map(([key,label])=><div key={key}><Label htmlFor={`pulse-${key}`}>{label} (ET)</Label><Input id={`pulse-${key}`} type="time" value={draft.session?.[key]??resolved[key]??""} onChange={e=>setDraft({...draft,session:{...draft.session,[key]:e.target.value}})}/></div>)}
        {draft.instrument==="options"&&<>{number("dte","Days to expiry",draft.options?.dte??resolved.optionDte,n=>setDraft({...draft,options:{dte:n,strikeOffset:draft.options?.strikeOffset??0}}),0,120)}{number("offset","Strike offset",draft.options?.strikeOffset??0,n=>setDraft({...draft,options:{dte:draft.options?.dte??resolved.optionDte,strikeOffset:n}}),-5,5)}</>}
        </div><div className="mt-3 flex items-center justify-between"><Label htmlFor="pulse-trailing">Trailing protection</Label><Switch id="pulse-trailing" checked={resolved.trailing} onCheckedChange={v=>setDraft({...draft,overrides:{...draft.overrides,trailing:v}})}/></div><div className="mt-3 flex items-center justify-between"><Label htmlFor="pulse-bank">Journal banking</Label><Switch id="pulse-bank" checked={!!draft.banking?.enabled} onCheckedChange={v=>setDraft({...draft,banking:{enabled:v,startBalance:draft.allocation,bankTrigger:25200}})}/></div>{draft.banking?.enabled&&<div className="mt-3 grid grid-cols-2 gap-3">{number("restart","Restart balance ($)",draft.banking.startBalance,n=>setDraft({...draft,banking:{...draft.banking,enabled:true,startBalance:n,bankTrigger:draft.banking?.bankTrigger??25200}}),1)}{number("trigger","Bank trigger ($)",draft.banking.bankTrigger,n=>setDraft({...draft,banking:{...draft.banking,enabled:true,startBalance:draft.banking?.startBalance??200,bankTrigger:n}}),1)}</div>}</details>
        {resolved.warnings.map(w=><p key={w} className="text-xs text-warning">{w}</p>)}
        <Button className="w-full" disabled={busy} onClick={persist}>{busy?"Saving…":"Save paper bot"}</Button>
      </div>}
    </DialogContent></Dialog>
  </section>;
}