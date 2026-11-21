import type { ReactNode } from 'react';
import { PublicHeader } from '@/routes/strategies/index';
export function PublicDocument({ title, children, updated = 'November 20, 2026' }: { title: string; children: ReactNode; updated?: string }) {
  return <div className="min-h-screen bg-background text-foreground"><PublicHeader /><main className="mx-auto max-w-3xl space-y-6 px-5 pb-16 pt-8"><h1 className="text-3xl font-bold">{title}</h1><p className="text-xs text-muted-foreground">Last updated {updated}</p><div className="space-y-6 text-sm leading-7 text-muted-foreground">{children}</div></main></div>;
}