import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { PLAYBOOK } from "@/lib/strategy-platform";
import { SITE, findStrategy, strategyDescription, strategySlug, strategyTitle, tfLabel } from "@/lib/strategy-seo";
import { PublicHeader } from "./index";
import { publicStrategy, SCAN_UNIVERSE_DESCRIPTION } from '@/lib/public-strategies';

export const Route = createFileRoute("/strategies/$slug")({
  staticData: { sitemap: false },
  loader: ({ params }) => {
    const s = findStrategy(params.slug);
    if (!s) throw notFound();
    return { id: s.id };
  },
  head: ({ params, loaderData }) => {
    const s = loaderData ? PLAYBOOK.find((p) => p.id === loaderData.id) : undefined;
    if (!s) return { meta: [{ title: "Strategy not found | The Signal Spot" }, { name: "robots", content: "noindex" }] };
    const url = `${SITE}/strategies/${params.slug}`;
    const title = strategyTitle(s), desc = strategyDescription(s);
    return {
      meta: [
        { title }, { name: "description", content: desc },
        { property: "og:title", content: title }, { property: "og:description", content: desc },
        { property: "og:type", content: "article" }, { property: "og:url", content: url },
        { name: "twitter:card", content: "summary" },
        { name: 'twitter:url', content: url },
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: [{
        type: "application/ld+json",
        children: JSON.stringify([
          { "@context": "https://schema.org", "@type": "Article", headline: `${s.name} trading strategy`, description: desc, url, publisher: { "@type": "Organization", name: "The Signal Spot" } },
          { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
            { "@type": "ListItem", position: 1, name: "Strategies", item: `${SITE}/strategies` },
            { "@type": "ListItem", position: 2, name: s.name, item: url },
          ] },
        ]),
      }],
    };
  },
  notFoundComponent: () => (
    <div className="min-h-screen bg-background p-10 text-center text-foreground">
      Strategy not found. <Link to="/strategies" className="text-primary underline">See all strategies</Link>
    </div>
  ),
  component: StrategyPage,
});

function StrategyPage() {
  const { id } = Route.useLoaderData();
  const s = publicStrategy(id);
  if (!s) return <p>Strategy unavailable.</p>;
  const others = PLAYBOOK.filter((p) => p.id !== id).slice(0, 4);
  return (
    <div className="min-h-screen bg-background text-foreground">
      <PublicHeader />
      <main className="mx-auto max-w-3xl px-5 pb-16">
        <nav className="text-sm text-muted-foreground"><Link to="/strategies" className="hover:text-foreground">Strategies</Link> / {s.name}</nav>
        <div className="mt-4 text-xs uppercase tracking-wide text-primary">{s.category} · {tfLabel(s.timeframe)} chart</div>
        <h1 className="mt-1 text-3xl font-bold md:text-4xl">{s.name} trading strategy</h1>
        <p className="mt-3 text-lg text-muted-foreground">{s.summary}</p>
        <section className="mt-8 border-y border-border py-5">
          <h2 className="text-xl font-semibold">Strategy rules</h2>
          <p className="mt-2 text-sm text-muted-foreground">These are the scanner’s published default parameters. Bot settings can be adjusted in the member area; they do not change the read-only alert defaults.</p>
          <ul className="mt-4 space-y-3">
            {s.rules.map((r) => <li key={r} className="flex gap-3 text-sm"><Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />{r}</li>)}
          </ul>
        </section>
        <section className="mt-8">
          <h2 className="text-xl font-semibold">How the alerts work</h2>
          <p className="mt-2 text-muted-foreground">{SCAN_UNIVERSE_DESCRIPTION}</p>
          {id === 'iwm' && <p className="mt-3 text-muted-foreground">The automated IWM bot trades IWM options only. The read-only 9/20 momentum scanner also evaluates the other selected symbols; those alerts do not mean the IWM bot trades them.</p>}
          <p className="mt-3 text-muted-foreground">When the {s.name.replace(/^The /, '')} setup triggers on the {tfLabel(s.timeframe)} chart, the member feed shows the ticker, direction, underlying price, trigger time and reason. Alerts may be delayed or missed; an alert does not choose or verify an option contract.</p>
          <Link to="/" className="mt-5 inline-block rounded-md bg-primary px-5 py-3 font-semibold text-primary-foreground hover:opacity-90">Start 7-day free trial</Link>
        </section>
        <section className="mt-12">
          <h2 className="text-lg font-semibold">More strategies</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {others.map((o) => (
              <Link key={o.id} to="/strategies/$slug" params={{ slug: strategySlug(o.id) }} className="rounded-md border border-border p-4 text-sm hover:border-primary">
                <div className="font-medium">{o.name}</div><div className="text-muted-foreground">{tfLabel(o.timeframe)} chart</div>
              </Link>
            ))}
          </div>
        </section>
        <p className="mt-10 text-xs text-muted-foreground">Educational information only, not investment advice. Past signals do not guarantee future results. Options trading involves substantial risk of loss.</p>
      </main>
    </div>
  );
}
