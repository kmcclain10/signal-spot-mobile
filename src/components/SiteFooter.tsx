import { Link, useRouterState } from '@tanstack/react-router';
import { SUPPORT_EMAIL } from '@/lib/public-content';

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
      <a href={`mailto:${SUPPORT_EMAIL}`} className="inline-block underline">{SUPPORT_EMAIL}</a>
      <p>Educational alerts, not financial advice. Past signals do not guarantee future results. Options trading involves substantial risk of loss.</p>
    </div>
  </footer>;
}