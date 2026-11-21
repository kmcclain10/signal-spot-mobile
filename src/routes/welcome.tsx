import { createFileRoute, Link } from "@tanstack/react-router";
import { Bell, Bot, Check, Zap, LineChart } from "lucide-react";
import { PLANS } from "@/lib/plans";

import { PUBLIC_DESCRIPTION, publicHead } from '@/lib/public-content';
import { SCAN_UNIVERSE_DESCRIPTION } from '@/lib/public-strategies';
import { PLAYBOOK } from '@/lib/strategy-platform';
import { PublicHeader } from '@/routes/strategies/index';
import { Button } from '@/components/ui/button';

export const Route = createFileRoute("/welcome")({
  staticData: { sitemap: true },
  head: () => publicHead('Rule-based options alerts', PUBLIC_DESCRIPTION, '/welcome'),
  component: Landing,
});

const features = [
  { icon: Bell, t: "Rule-triggered alerts", d: "See the ticker, CALL or PUT direction, underlying price, trigger time and reason in the member feed. Alerts can be delayed or missed." },
  { icon: Zap, t: "11 rule-based strategies", d: "9/20 EMA momentum, The Scalpers, ORB, VWAP reclaim, Supertrend and more. We do not publish a performance record on this page; past signals do not guarantee future results." },
  { icon: LineChart, t: "Market scanning", d: "SPY, QQQ, IWM and a daily refreshed top-ten US company list. Custom tickers use the same published rules, not personalized recommendations." },
  { icon: Bot, t: "Bots (optional)", d: "Connect your own Alpaca account and let a bot follow published entry and exit rules. This is not personalized advice and does not guarantee a profit." },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <PublicHeader />

      <section className="mx-auto max-w-4xl px-5 pb-16 pt-12 text-center">
        <p className="mb-4 text-sm font-semibold text-primary">RULE-BASED OPTIONS &amp; EQUITY ALERTS</p>
        <h1 className="text-4xl font-black leading-tight sm:text-5xl md:text-6xl">The Signal Spot</h1>
        <p className="mx-auto mt-4 max-w-2xl text-2xl font-semibold leading-snug md:text-3xl">See the setup <span className="text-primary">when the rules trigger.</span></p>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">Read the alert and decide for yourself. An optional bot add-on can follow the same published rules in an account you connect, if you turn it on.</p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Button asChild size="lg"><Link to="/auth">Start 7-day free trial</Link></Button>
          <Button asChild variant="outline" size="lg"><a href="#pricing">See pricing</a></Button>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-4 px-5 pb-20 sm:grid-cols-2 lg:grid-cols-4">
        {features.map((f) => (
          <div key={f.t} className="border-t border-border py-5">
            <f.icon className="mb-3 h-6 w-6 text-primary" />
            <h3 className="font-semibold">{f.t}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{f.d}</p>
          </div>
        ))}
      </section>

      <section className="mx-auto grid max-w-5xl gap-8 border-y border-border px-5 py-10 md:grid-cols-2">
        <div><h2 className="text-2xl font-semibold">How you get alerts</h2><p className="mt-3 text-sm leading-6 text-muted-foreground">Alerts appear in your member feed. Optional browser notifications work while the app is open and permission is granted. Discord, Telegram and background push delivery are not currently offered.</p><p className="mt-3 text-sm leading-6 text-muted-foreground">{SCAN_UNIVERSE_DESCRIPTION}</p></div>
        <article className="rounded-lg border border-border bg-card p-5" aria-label="Sample alert format">
          <p className="text-xs font-semibold text-potential">SAMPLE FORMAT ONLY · NOT A RECOMMENDATION</p>
          <div className="mt-4 flex items-baseline justify-between gap-4"><h3 className="text-2xl font-bold">SPY</h3><span className="font-semibold text-primary">CALL direction</span></div>
          <dl className="mt-4 space-y-2 text-sm"><div className="flex justify-between gap-4"><dt className="text-muted-foreground">Underlying price</dt><dd className="num">$600.00 (illustrative)</dd></div><div className="flex justify-between gap-4"><dt className="text-muted-foreground">Strategy</dt><dd>Opening Bell · 5 min</dd></div><div className="flex justify-between gap-4"><dt className="text-muted-foreground">Trigger time</dt><dd>9:50 AM ET (illustrative)</dd></div></dl>
          <p className="mt-4 text-sm">Reason: closed above the 15-minute opening range high.</p><p className="mt-3 text-xs leading-5 text-muted-foreground">Illustrative values show the format only. This is not a current alert, a historical winning trade or a verified option contract.</p>
        </article>
      </section>
      <section className="mx-auto max-w-5xl px-5 py-12"><h2 className="text-2xl font-semibold">A plan before a trade</h2><p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">Focus on a small set of strategies you understand, such as the 5-minute 9/20 cross or opening range breakout. Decide your trade limit, risk budget and exit plan before entering. Liquid at-the-money options may be easier to evaluate, but spreads and liquidity still matter. Fewer trades or a profit target do not guarantee consistent success.</p></section>
      <section id="pricing" className="mx-auto max-w-5xl px-5 pb-20">
        <h2 className="text-center text-3xl font-black">Simple pricing</h2>
        <p className="mt-2 text-center text-muted-foreground">Start with a 7-day free trial. Card required, cancel anytime. Save two months with yearly.</p>
        <div className="mt-8 grid gap-5 md:grid-cols-2">
          {(["alerts", "bots"] as const).map((k) => {
            const p = PLANS[k];
            const hot = k === "bots";
            return (
              <div key={k} className={`rounded-lg border p-6 ${hot ? "border-primary bg-card" : "border-border bg-card"}`}>
                {hot && <p className="mb-2 text-xs font-semibold text-primary">OPTIONAL AUTOMATION</p>}
                <h3 className="text-xl font-bold">{p.name}</h3>
                <p className="mt-2"><span className="text-4xl font-black">${p.monthly}</span><span className="text-muted-foreground">/mo</span></p>
                <p className="text-sm text-muted-foreground">or ${p.yearly}/year</p>
                <ul className="mt-5 space-y-2 text-sm">
                  {p.features.map((x) => <li key={x} className="flex gap-2"><Check className="h-4 w-4 shrink-0 text-primary" />{x}</li>)}
                </ul>
                {hot && <p className="mt-4 text-xs leading-5 text-muted-foreground">Pulse bots: {PLAYBOOK.filter(s => s.id !== 'iwm').map(s => s.name).join(', ')}. These additional bots are paper-only and follow published rules with your configured settings.</p>}
                <Button asChild variant={hot ? 'default' : 'outline'} className="mt-6 w-full"><Link to="/auth">Get {p.name}</Link></Button>
              </div>
            );
          })}
        </div>
      </section>


    </div>
  );
}
