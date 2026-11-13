import { createFileRoute, Link } from '@tanstack/react-router';
import { useSuspenseQuery } from '@tanstack/react-query';
import { Activity, ArrowRight, CandlestickChart } from 'lucide-react';
import { HomePortfolio, homePortfolioOptions } from '@/components/HomePortfolio';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/common';
import { RealStrategyFeed } from '@/components/RealStrategyFeed';
import { strategyPlatformOptions, useStrategyRealtime } from '@/hooks/use-strategy-platform';
import { strategyLabel } from '@/lib/strategy-platform';
import { botHealth } from '@/lib/bots-rules';
import { nyDate } from '@/lib/market-hours';
import { cn } from '@/lib/utils';
export const Route = createFileRoute('/_authenticated/')({
  head:()=>({meta:[{title:'Home — Pulse Signals'},{name:'description',content:'Your Alpaca portfolio, real strategy triggers and active trading fleet.'},{property:'og:title',content:'Home — Pulse Signals'},{property:'og:description',content:'Your account and real IWM and Pulse strategy activity.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary'}]}),
  loader:async({context})=>{await Promise.all([context.queryClient.ensureQueryData(homePortfolioOptions),context.queryClient.ensureQueryData(strategyPlatformOptions)]);},
  errorComponent:({error})=><ErrorState error={error}/>,notFoundComponent:()=> <p>Home unavailable.</p>,component:Home,
});
function Home(){
  const {data}=useSuspenseQuery(strategyPlatformOptions);
  useStrategyRealtime(Route.useRouteContext().user.id);
  const today=nyDate();
  const signals=data.signals.filter(s=>nyDate(new Date(s.at))===today);
  const health=botHealth(new Date(),data.settings,data.state);
  const active=data.bots.filter(b=>b.enabled&&!b.kill_switch);
  return <div className="space-y-8">
    <header className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-3xl font-semibold">Home</h1><Button asChild><Link to="/trade"><CandlestickChart/>Trade</Link></Button></header>
    <HomePortfolio/>
    <section className="border-y py-5"><div className="flex items-center justify-between"><h2 className="flex items-center gap-2 font-semibold"><Activity className="size-4 text-primary"/>Strategy fleet</h2><Button asChild variant="link" size="sm"><Link to="/bots">Manage<ArrowRight/></Link></Button></div>
      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-3"><Link to="/iwm" className="flex items-center gap-2 text-sm"><span className={cn('size-2 rounded-full',health.status==='running'?'bg-gain':health.status==='offline'?'bg-loss':'bg-muted-foreground')}/>IWM 8/20 · {data.settings?.trading_env==='live'?'LIVE':'PAPER'} · {health.detail}</Link>{active.map(b=><Link key={b.id} to="/bots" className="text-sm text-potential">{strategyLabel((b.config as Record<string,any>).strategyId)} · PAPER</Link>)}</div>
      <div className="num mt-5 grid grid-cols-2 gap-4"><div><p className="font-sans text-xs text-muted-foreground">IWM strategy balance</p><p className="mt-1 text-xl">{data.state?.balance!=null?`$${Number(data.state.balance).toFixed(2)}`:'—'}</p></div><div><p className="font-sans text-xs text-muted-foreground">WMT savings purchased</p><p className="mt-1 text-xl text-banked">{data.state?`$${Number(data.state.savings_total??0).toFixed(2)}`:'—'}</p></div></div>
    </section>
    <section><div className="mb-4 flex flex-wrap items-center justify-between gap-2"><h2 className="text-xl font-semibold">Today's strategy signals <span className="num text-sm text-potential">{signals.length}</span></h2><Button asChild variant="link"><Link to="/signals">History<ArrowRight/></Link></Button></div><RealStrategyFeed rows={signals.slice(0,12)}/></section>
    <div className="flex gap-4 border-t pt-4"><Button asChild variant="outline"><Link to="/strategies">Strategy playbook</Link></Button><Button asChild variant="ghost"><Link to="/performance">Actual performance<ArrowRight/></Link></Button></div>
  </div>;
}
