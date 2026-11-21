import { Activity } from 'lucide-react';
import { cn } from '@/lib/utils';

/** One wordmark for public pages, account entry and the trading shell. */
export function Brand({ className, compact = false }: { className?: string; compact?: boolean }) {
  return <span className={cn('inline-flex min-w-0 items-center gap-2.5 text-foreground', className)}>
    <Activity aria-hidden="true" className={cn('shrink-0 text-primary', compact ? 'size-5' : 'size-7')} strokeWidth={2.5} />
    <span className={cn('whitespace-nowrap font-bold leading-tight', compact ? 'text-sm' : 'text-base sm:text-lg')}>The Signal Spot</span>
  </span>;
}