import { useState } from 'react';
import { queryOptions, useSuspenseQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Save, Radar } from 'lucide-react';
import { toast } from 'sonner';
import { getAlertPreferences, saveAlertPreferences } from '@/lib/alert-preferences.functions';
import { CORE_SCAN_SYMBOLS, type AlertPreferences } from '@/lib/alert-preferences';
import { PLAYBOOK } from '@/lib/strategy-platform';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export const alertPreferencesOptions=queryOptions({queryKey:['alert-preferences'],queryFn:()=>getAlertPreferences(),staleTime:30000});
export function AlertSelections() {
  const {data}=useSuspenseQuery(alertPreferencesOptions);
  const [draft,setDraft]=useState<AlertPreferences>(data.preferences);
  const [symbolText,setSymbolText]=useState(data.preferences.custom_rules.map(r=>r.symbols.join(', ')));
  const qc=useQueryClient();
  const save=useMutation({mutationFn:()=>saveAlertPreferences({data:{...draft,custom_rules:draft.custom_rules.map((r,i)=>({...r,symbols:[...new Set((symbolText[i]??'').split(/[\s,]+/).filter(Boolean).map(s=>s.toUpperCase()))]}))}}),onSuccess:()=>{void qc.invalidateQueries({queryKey:['alert-preferences']});toast.success('Alert selections saved');},onError:(e)=>toast.error(e.message)});
  const rule=(i:number,patch:Partial<AlertPreferences['custom_rules'][number]>)=>setDraft(p=>({...p,custom_rules:p.custom_rules.map((r,n)=>n===i?{...r,...patch}:r)}));
  return <section className="space-y-4 border-y border-border py-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="flex items-center gap-2 text-lg font-semibold"><Radar className="size-5 text-potential"/>Market scans</h2><label className="flex items-center gap-2 text-sm">Automatic<Switch aria-label="Automatic market scanning" checked={draft.automatic_enabled} onCheckedChange={automatic_enabled=>setDraft(p=>({...p,automatic_enabled}))}/></label></div>
    <div className="flex flex-wrap gap-x-4 gap-y-2 font-mono text-sm">{[...CORE_SCAN_SYMBOLS,...(data.universe?.symbols??[])].map(s=><span key={s} className="text-gain">{s}</span>)}</div>
    <p className="text-xs text-muted-foreground">{data.universe?`10 largest Alpaca-tradable US companies · Ranking checked ${new Date(data.universe.refreshed_at).toLocaleDateString()} · CompaniesMarketCap`:'Top-ten US company ranking pending the next market scan.'} · Alerts only; no orders.</p>
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{PLAYBOOK.map(s=><label key={s.id} className="flex items-center justify-between gap-3 border-b border-border py-2 text-sm"><span>{s.name}</span><Switch aria-label={`Scan ${s.name}`} checked={draft.strategy_ids.includes(s.id)} onCheckedChange={checked=>setDraft(p=>({...p,strategy_ids:checked?[...p.strategy_ids,s.id]:p.strategy_ids.filter(id=>id!==s.id)}))}/></label>)}</div>
    <div className="flex items-center justify-between"><h3 className="font-semibold">Your own alerts</h3><Button variant="outline" size="sm" onClick={()=>{setDraft(p=>({...p,custom_rules:[...p.custom_rules,{strategy_id:'iwm',symbols:['SPY'],direction:'both',enabled:true}]}));setSymbolText(p=>[...p,'SPY']);}}><Plus className="size-4"/>Add alert</Button></div>
    {draft.custom_rules.map((r,i)=><div key={i} className="grid items-center gap-3 border-b border-border pb-3 sm:grid-cols-[1fr_1fr_140px_auto]">
      <Select value={r.strategy_id} onValueChange={strategy_id=>rule(i,{strategy_id})}><SelectTrigger aria-label={`Alert ${i+1} strategy`}><SelectValue/></SelectTrigger><SelectContent>{PLAYBOOK.map(s=><SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select>
      <Input aria-label={`Alert ${i+1} symbols`} placeholder="Symbols, e.g. AMD, NFLX" value={symbolText[i]??''} onChange={e=>setSymbolText(p=>p.map((v,n)=>n===i?e.target.value:v))}/>
      <Select value={r.direction} onValueChange={v=>rule(i,{direction:v as typeof r.direction})}><SelectTrigger aria-label={`Alert ${i+1} direction`}><SelectValue/></SelectTrigger><SelectContent><SelectItem value="both">Both directions</SelectItem><SelectItem value="long">Bullish</SelectItem><SelectItem value="short">Bearish</SelectItem></SelectContent></Select>
      <div className="flex items-center gap-3"><Switch aria-label={`Enable alert ${i+1}`} checked={r.enabled} onCheckedChange={enabled=>rule(i,{enabled})}/><Button variant="ghost" size="icon" aria-label={`Remove alert ${i+1}`} onClick={()=>{setDraft(p=>({...p,custom_rules:p.custom_rules.filter((_,n)=>n!==i)}));setSymbolText(p=>p.filter((_,n)=>n!==i));}}><Trash2 className="size-4"/></Button></div>
    </div>)}
    <div className="flex flex-wrap items-center gap-3"><Button disabled={!data.allowed||save.isPending} onClick={()=>save.mutate()}><Save className="size-4"/>{save.isPending?'Saving…':'Save alerts'}</Button>{!data.allowed&&<p className="text-xs text-muted-foreground">Alerts or AI Bots subscription required.</p>}</div>
  </section>;
}