import { Link } from '@tanstack/react-router';
import { ArrowUpRight, ArrowDownRight, ArrowRight, Bot, Radio } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/common';
import { strategyLabel, type RealSignal } from '@/lib/strategy-platform';
import { cn } from '@/lib/utils';

export function RealStrategyFeed({rows}:{rows:RealSignal[]}) {
  if(!rows.length) return <EmptyState title="No strategy triggers in this period." />;
  return <div className="divide-y border-y">{rows.map(s=><article key={s.id} className="py-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-3"><span className={cn('mt-1 rounded-md p-2',s.side==='long'?'bg-gain/10 text-gain':'bg-loss/10 text-loss')}>{s.side==='long'?<ArrowUpRight className="size-5"/>:<ArrowDownRight className="size-5"/>}</span>
        <div className="min-w-0"><p className="text-xs text-muted-foreground">{strategyLabel(s.strategy)}</p><h3 className="mt-1 text-lg font-semibold">{s.symbol} <span className={s.side==='long'?'text-gain':'text-loss'}>{s.side==='long'?'Bullish':'Bearish'}</span></h3></div>
      </div>
      <span className={cn('flex items-center gap-1.5 text-xs font-medium',s.fill!==null?'text-gain':'text-potential')}>{s.fill!==null?<Bot className="size-3.5"/>:<Radio className="size-3.5"/>}{s.status==='alert'?'SETUP ALERT':s.status.toUpperCase()}{s.fill!==null?` @ $${s.fill.toFixed(2)}`:''}</span>
    </div>
    <p className="mt-3 break-words text-sm">{s.reason}</p>
    {s.contract && <p className="num mt-2 break-all text-xs text-muted-foreground">{s.contract}</p>}
    <div className="mt-3 flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-muted-foreground">{new Date(s.at).toLocaleString([], {month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})} · {s.price!==null?`Underlying $${s.price.toFixed(2)} · `:''}{s.environment==='unrecorded'?'Account not recorded':s.environment.toUpperCase()} · {s.feed}</p>
      <Button asChild size="sm" variant="outline"><Link to="/trade" search={{symbol:s.symbol,side:'buy',option:s.side==='long'?'CALL':'PUT'}}>Review options<ArrowRight className="size-3.5"/></Link></Button>
    </div>
  </article>)}</div>;
}