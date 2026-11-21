import { Link, useRouterState } from '@tanstack/react-router';
import { SUPPORT_EMAIL, X_HANDLE, X_URL } from '@/lib/public-content';

export function LegalLinks() {
  return <><Link to="/terms" className="text-primary underline">Terms</Link>, <Link to="/privacy" className="text-primary underline">Privacy Policy</Link>, and <Link to="/risk" className="text-primary underline">Risk disclosure</Link></>;
}
export function SiteFooter() {
  const memberPage = useRouterState({ select: s => s.matches.some(m => m.routeId === '/_authenticated') });
  return <footer className={`border-t border-border px-5 py-8 text-xs text-muted-foreground ${memberPage ? 'pb-28 lg:ml-60 lg:pb-8' : ''}`}>
    <div className="mx-auto max-w-5xl space-y-3">
      <p className="font-semibold text-foreground">The Signal Spot · © 2026</p>
      <p>The Signal Spot publishes rule-based options alerts on liquid US markets.</p>
      <nav aria-label="Company and legal" className="flex flex-wrap gap-x-5 gap-y-3"><Link to="/strategies">Strategies</Link><Link to="/contact">Contact</Link><Link to="/terms">Terms</Link><Link to="/privacy">Privacy</Link><Link to="/risk">Risk</Link></nav>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <a href={`mailto:${SUPPORT_EMAIL}`} className="underline">{SUPPORT_EMAIL}</a>
        <a href={X_URL} target="_blank" rel="noopener noreferrer" aria-label={`The Signal Spot on X, ${X_HANDLE}`} className="inline-flex items-center gap-2 hover:text-foreground">
          <svg viewBox="0 0 24 24" className="size-4 shrink-0" fill="currentColor" aria-hidden><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
          <span className="underline">{X_HANDLE}</span>
        </a>
      </div>
      <p>Educational alerts, not financial advice. Past signals do not guarantee future results. Options trading involves substantial risk of loss.</p>
    </div>
  </footer>;
}