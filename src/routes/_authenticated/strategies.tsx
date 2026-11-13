import { createFileRoute, Link } from '@tanstack/react-router';
import { useSuspenseQuery } from '@tanstack/react-query';
import { ArrowRight, Activity, Target, Waves, TrendingUp } from 'lucide-react';
import { PLAYBOOK } from '@/lib/strategy-platform';
import { strategyPlatformOptions, useStrategyRealtime } from '@/hooks/use-strategy-platform';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/common';
export const Route=createFileRoute('/_authenticated/strategies')({
  head:()=>({meta:[{title:'Strategy Playbook — Pulse Signals'},{name:'description',content:'The eleven executable IWM and Pulse strategies, their entry rules and trading controls.'},{property:'og:title',content:'Strategy Playbook — Pulse Signals'},{property:'og:description',content:'Real strategies. Current rules. Your active fleet.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary'}]}),
  loader:({context})=>context.queryClient.ensureQueryData(strategyPlatformOptions),errorComponent:({error})=><ErrorState error={error}/>,notFoundComponent:()=> <p>Playbook unavailable.</p>,component:Playbook,
});
function Playbook(){
  const {data}=useSuspenseQuery(strategyPlatformOptions);useStrategyRealtime(Route.useRouteContext().user.id);
  return <div className="space-y-7"><header className="flex flex-wrap items-end justify-between gap-3"><div><p className="mb-2 text-xs font-medium text-primary">PULSE SIGNALS / 11 STRATEGIES</p><h1 className="text-3xl font-semibold">Strategy playbook</h1></div><Button asChild variant="outline"><Link to="/bots">Manage fleet<ArrowRight/></Link></Button></header>
    <div className="grid gap-x-8 md:grid-cols-2">{PLAYBOOK.map((s,i)=>{
      const configured=data.bots.filter(b=>(b.config as Record<string,any>).strategyId===s.id);
      const enabled=s.id==='iwm'?!!data.settings?.enabled:configured.some(b=>b.enabled&&!b.kill_switch);
      const Icon=s.category==='Breakout'?Target:s.category==='Mean reversion'?Waves:s.category==='Trend'?TrendingUp:Activity;
      return <article key={s.id} className="border-t py-6"><div className="flex items-start justify-between gap-3"><div className="flex gap-3"><Icon className="mt-1 size-5 text-primary"/><div><p className="num text-xs text-muted-foreground">{String(i+1).padStart(2,'0')} / {s.category}</p><h2 className="mt-1 text-xl font-semibold">{s.name}</h2></div></div><span className={enabled?'text-xs text-gain':'text-xs text-muted-foreground'}>{enabled?'ENABLED':'OFF'}</span></div>
        <p className="mt-4 text-sm text-muted-foreground">{s.summary}</p><p className="num mt-3 text-xs text-potential">{s.timeframe===1440?'Daily':`${s.timeframe} MIN`} · {s.id==='iwm'?(data.settings?.trading_env==='live'?'LIVE':'PAPER'):'PAPER'} · {configured.length?configured.map(b=>(b.config as Record<string,any>).symbols.join(', ')).join(' / '):s.symbol}</p>
        <details className="mt-4 text-sm"><summary className="cursor-pointer font-medium">Entry & exit rules</summary><ul className="mt-3 space-y-2 border-l border-primary pl-4 text-muted-foreground">{s.rules.map(rule=><li key={rule}>{rule}</li>)}</ul>{s.id!=='iwm'&&<p className="mt-3 text-xs text-muted-foreground">Actual sizing, stops and exits follow your saved bot settings.</p>}</details>
        <Button asChild variant="link" className="mt-3 px-0"><Link to={s.id==='iwm'?'/iwm':'/bots'}>{s.id==='iwm'?'Open IWM controls':'Configure strategy'}<ArrowRight/></Link></Button>
      </article>;
    })}</div>
  </div>;
}
