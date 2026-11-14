import { Link } from '@tanstack/react-router';
import { ArrowUpRight, ArrowDownRight, ArrowRight, Bot, Radio, Clock, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/common';
import { PLAYBOOK, strategyLabel, type RealSignal } from '@/lib/strategy-platform';
import { cn } from '@/lib/utils';

function ago(at: string) {
  const m = Math.max(0, Math.round((Date.now() - Date.parse(at)) / 60000));
  if (m < 1) return 'just now'; if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60); return h < 24 ? `${h}h ago` : `${Math.round(h / 24)}d ago`;
}

export function RealStrategyFeed({rows}:{rows:RealSignal[]}) {
  if(!rows.length) return <EmptyState title="No strategy triggers in this period." />;
  return <div className="grid gap-3">{rows.map(s=>{
    const bull=s.side==='long', filled=s.fill!==null, fresh=Date.now()-Date.parse(s.at)<15*60000;
    const play=PLAYBOOK.find(p=>p.id===s.strategy);
    return <article key={s.id} className={cn('overflow-hidden rounded-xl border bg-card',fresh&&'border-potential/60')}>
      <div className={cn('h-1',bull?'bg-gain':'bg-loss')}/>
      <div className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{strategyLabel(s.strategy)}{play?` · ${play.timeframe}-min`:''}</p>
            <div className="mt-1 flex items-baseline gap-2">
              <h3 className="num text-2xl font-bold tracking-tight">{s.symbol}</h3>
              <span className={cn('flex items-center gap-0.5 text-sm font-semibold',bull?'text-gain':'text-loss')}>{bull?<ArrowUpRight className="size-4"/>:<ArrowDownRight className="size-4"/>}{bull?'Buy CALL':'Buy PUT'}</span>
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold',filled?'bg-gain/15 text-gain':'bg-potential/15 text-potential')}>
              {filled?<Bot className="size-3"/>:<Radio className={cn('size-3',fresh&&'animate-pulse')}/>}
              {filled?`BOT FILLED $${s.fill!.toFixed(2)}`:s.status==='alert'?'NEW ALERT':s.status.toUpperCase()}
            </span>
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground"><Clock className="size-3"/>{ago(s.at)}</span>
          </div>
        </div>
        <dl className="mt-4 grid grid-cols-3 gap-2 rounded-lg bg-muted/40 p-3 text-xs">
          <div><dt className="text-muted-foreground">Trigger</dt><dd className="num mt-0.5 font-semibold">{s.price!==null?`$${s.price.toFixed(2)}`:'—'}</dd></div>
          <div><dt className="text-muted-foreground">Time</dt><dd className="num mt-0.5 font-semibold">{new Date(s.at).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'})}</dd></div>
          <div><dt className="text-muted-foreground">Account</dt><dd className={cn('mt-0.5 font-semibold',s.environment==='live'&&'text-potential')}>{s.environment==='unrecorded'?'—':s.environment.toUpperCase()}</dd></div>
        </dl>
        <p className="mt-3 break-words text-sm">{s.reason}</p>
        {s.contract && <p className="num mt-1 break-all text-xs text-muted-foreground">Contract {s.contract}</p>}
        {play && <details className="group mt-3 text-xs"><summary className="flex cursor-pointer list-none items-center gap-1 font-medium text-muted-foreground">Exit plan<ChevronDown className="size-3 transition group-open:rotate-180"/></summary>
          <ul className="mt-2 list-disc space-y-1 pl-4 text-muted-foreground">{play.rules.map(r=><li key={r}>{r}</li>)}</ul></details>}
        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="text-[11px] text-muted-foreground">{new Date(s.at).toLocaleDateString([], {month:'short',day:'numeric'})} · {s.feed}</p>
          <Button asChild size="sm" variant={filled?'outline':'default'}><Link to="/trade" search={{symbol:s.symbol,side:'buy',option:bull?'CALL':'PUT'}}>{filled?'View options':'Trade this'}<ArrowRight className="size-3.5"/></Link></Button>
        </div>
      </div>
    </article>;})}</div>;
}
