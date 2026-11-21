import { createFileRoute, Link } from "@tanstack/react-router";
import { Brand } from "@/components/Brand";
import { PLAYBOOK } from "@/lib/strategy-platform";
import { SITE, strategySlug, tfLabel } from "@/lib/strategy-seo";
import { publicStrategy } from '@/lib/public-strategies';
import { Button } from '@/components/ui/button';

const TITLE = "Options & Stock Trading Strategies — 9/20 EMA, ORB, VWAP | The Signal Spot";
const DESC = "Explore 11 rule-based trading strategies: 9/20 EMA cross, opening range breakout, VWAP reclaim, SuperTrend, MACD, TTM Squeeze and more, with real-time alerts.";

export const Route = createFileRoute("/strategies/")({
  staticData: { sitemap: true },
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${SITE}/strategies` },
      { name: "twitter:card", content: "summary" },
      { name: 'twitter:url', content: `${SITE}/strategies` },
    ],
    links: [{ rel: "canonical", href: `${SITE}/strategies` }],
    scripts: [{
      type: "application/ld+json",
      children: JSON.stringify({
        "@context": "https://schema.org", "@type": "ItemList", name: "Trading strategies",
        itemListElement: PLAYBOOK.map((s, i) => ({ "@type": "ListItem", position: i + 1, name: s.name, url: `${SITE}/strategies/${strategySlug(s.id)}` })),
      }),
    }],
  }),
  component: StrategiesIndex,
});

export function PublicHeader() {
  return (
    <header className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-4 gap-y-3 px-5 py-5">
      <Link to="/welcome" aria-label="The Signal Spot home"><Brand /></Link>
      <nav className="flex items-center gap-3 text-sm">
        <Link to="/strategies" className="text-muted-foreground hover:text-foreground">Strategies</Link>
        <Button asChild variant="outline" size="sm"><Link to="/auth">Sign in</Link></Button>
      </nav>
    </header>
  );
}

function StrategiesIndex() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <PublicHeader />
      <main className="mx-auto max-w-5xl px-5 pb-16">
        <h1 className="text-3xl font-bold md:text-4xl">Trading strategies behind every alert</h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">Every The Signal Spot alert comes from one of these rule-based strategies. Each page explains the chart, the entry trigger and the exit rules.</p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {PLAYBOOK.map((s) => (
            <Link key={s.id} to="/strategies/$slug" params={{ slug: strategySlug(s.id) }} className="rounded-lg border border-border bg-card p-5 hover:border-primary">
              <div className="text-xs uppercase tracking-wide text-primary">{s.category} · {tfLabel(s.timeframe)} chart</div>
              <h2 className="mt-1 text-lg font-semibold">{s.name}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{publicStrategy(s.id)?.summary ?? s.summary}</p>
            </Link>
          ))}
        </div>
        <p className="mt-10 text-xs text-muted-foreground">Educational information only, not investment advice. Options trading involves substantial risk of loss.</p>
      </main>
    </div>
  );
}
