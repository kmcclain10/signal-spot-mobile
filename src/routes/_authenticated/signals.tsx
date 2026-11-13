import { createFileRoute } from '@tanstack/react-router';
import { useSuspenseQuery } from '@tanstack/react-query';
import { Download, Radio } from 'lucide-react';
import { strategyPlatformOptions,useStrategyRealtime } from '@/hooks/use-strategy-platform';
import { PLAYBOOK,strategyLabel } from '@/lib/strategy-platform';
import { RealStrategyFeed } from '@/components/RealStrategyFeed';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select,SelectContent,SelectItem,SelectTrigger,SelectValue } from '@/components/ui/select';
import { ErrorState } from '@/components/common';
import { nyDate } from '@/lib/market-hours';
import { AlertSelections, alertPreferencesOptions } from '@/components/AlertSelections';
export const Route=createFileRoute('/_authenticated/signals')({
  validateSearch:(s:Record<string,unknown>):{strategy?:string;date?:string;symbol?:string}=>({strategy:typeof s.strategy==='string'?s.strategy:'all',date:typeof s.date==='string'?s.date:'',symbol:typeof s.symbol==='string'?s.symbol:''}),
  head:()=>({meta:[{title:'Real Strategy Signals — Pulse Signals'},{name:'description',content:'Actual IWM and Pulse strategy triggers, bot fills and signal history.'},{property:'og:title',content:'Real Strategy Signals — Pulse Signals'},{property:'og:description',content:'Authentic market triggers from your executable trading strategies.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary'}]}),
  loader:({context})=>Promise.all([context.queryClient.ensureQueryData(strategyPlatformOptions),context.queryClient.ensureQueryData(alertPreferencesOptions)]),errorComponent:({error})=><ErrorState error={error}/>,notFoundComponent:()=> <p>Signals unavailable.</p>,component:Signals,
});
function Signals(){
  const {data}=useSuspenseQuery(strategyPlatformOptions);useStrategyRealtime(Route.useRouteContext().user.id);
  const search=Route.useSearch(),navigate=Route.useNavigate();
  const rows=data.signals.filter(s=>(!search.strategy||search.strategy==='all'||s.strategy===search.strategy)&&(!search.date||nyDate(new Date(s.at))===search.date)&&(!search.symbol||s.symbol.includes(search.symbol.toUpperCase())));
  const update=(patch:Partial<typeof search>)=>void navigate({search:{...search,...patch},replace:true});
  function download(){const esc=(v:unknown)=>`"${String(v??'').replaceAll('"','""')}"`;const text=[['time','strategy','symbol','side','underlying','contract','fill','status','account','feed','reason'],...rows.map(s=>[s.at,strategyLabel(s.strategy),s.symbol,s.side,s.price,s.contract,s.fill,s.status,s.environment,s.feed,s.reason])].map(r=>r.map(esc).join(',')).join('\n');const url=URL.createObjectURL(new Blob([text],{type:'text/csv'}));const a=document.createElement('a');a.href=url;a.download='pulse-real-signals.csv';a.click();URL.revokeObjectURL(url);}
  return <div className="space-y-6"><header className="flex items-center justify-between gap-3"><h1 className="flex items-center gap-2 text-3xl font-semibold"><Radio className="size-6 text-potential"/>Signals</h1><Button variant="outline" size="icon" title="Export signals" aria-label="Export signals" disabled={!rows.length} onClick={download}><Download/></Button></header>
    <div className="grid gap-3 sm:grid-cols-3"><Input aria-label="Signal date" type="date" value={search.date} onChange={e=>update({date:e.target.value})}/><Input aria-label="Signal symbol" placeholder="Symbol" value={search.symbol} onChange={e=>update({symbol:e.target.value})}/><Select value={search.strategy} onValueChange={strategy=>update({strategy})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">All strategies</SelectItem>{PLAYBOOK.map(s=><SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select></div>
    <AlertSelections/>
    <p className="text-xs text-muted-foreground">Latest {data.signals.length} recorded setups · Quotes may be indicative depending on your data plan.</p><RealStrategyFeed rows={rows}/>
  </div>;
}
