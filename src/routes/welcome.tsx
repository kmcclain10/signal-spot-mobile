import { createFileRoute, Link } from "@tanstack/react-router";
import { Activity, Bell, Bot, Check, Shield, Zap, LineChart } from "lucide-react";
import { PLANS } from "@/lib/plans";

const URL = "https://signal-spot-mobile.lovable.app";
const IMG = `${URL}/icons/og-image.png`;

export const Route = createFileRoute("/welcome")({
  head: () => ({
    meta: [
      { title: "Pulse Signals — Real-time options alerts & AI trading bots" },
      { name: "description", content: "Get real-time call and put alerts on SPY, QQQ, IWM and top US stocks from 11 proven strategies. Alerts from $49/mo, full AI bots from $99/mo." },
      { property: "og:title", content: "Pulse Signals — Real-time options alerts & AI trading bots" },
      { property: "og:description", content: "11 live strategies. Exact contracts. Instant alerts. Optional AI bots that trade for you." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${URL}/welcome` },
      { property: "og:image", content: IMG },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: IMG },
    ],
    links: [{ rel: "canonical", href: `${URL}/welcome` }],
  }),
  component: Landing,
});

const features = [
  { icon: Bell, t: "Instant setup alerts", d: "The moment a strategy triggers, you see the ticker, CALL or PUT, price and reason." },
  { icon: Zap, t: "11 real strategies", d: "9/20 EMA momentum, The Scalpers, ORB, VWAP reclaim, SuperTrend and more — no fake backtests." },
  { icon: LineChart, t: "Market-wide scanning", d: "SPY, QQQ, IWM and the 10 largest US companies scanned every minute, plus your own picks." },
  { icon: Bot, t: "AI bots (optional)", d: "Let bots enter, take profit and exit for you on your own Alpaca account." },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <div className="flex items-center gap-2 font-bold"><Activity className="h-6 w-6 text-primary" /> Pulse Signals</div>
        <Link to="/auth" className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-muted">Sign in</Link>
      </header>

      <section className="mx-auto max-w-4xl px-5 pb-16 pt-12 text-center">
        <p className="mb-4 inline-block rounded-full border border-primary/40 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-primary">Live market alerts</p>
        <h1 className="text-4xl font-black leading-tight md:text-6xl">Know the trade <span className="text-primary">the moment it sets up.</span></h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">Real-time CALL and PUT alerts from 11 rule-based strategies — with the exact setup, price and reason. Trade them yourself or let AI bots do it.</p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link to="/auth" className="rounded-md bg-primary px-6 py-3 font-semibold text-primary-foreground hover:bg-primary/90">Start getting alerts</Link>
          <a href="#pricing" className="rounded-md border border-border px-6 py-3 font-semibold hover:bg-muted">See pricing</a>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-4 px-5 pb-20 sm:grid-cols-2 lg:grid-cols-4">
        {features.map((f) => (
          <div key={f.t} className="rounded-xl border border-border bg-card p-5">
            <f.icon className="mb-3 h-6 w-6 text-primary" />
            <h3 className="font-semibold">{f.t}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{f.d}</p>
          </div>
        ))}
      </section>

      <section id="pricing" className="mx-auto max-w-5xl px-5 pb-20">
        <h2 className="text-center text-3xl font-black">Simple pricing</h2>
        <p className="mt-2 text-center text-muted-foreground">Cancel anytime. Save two months with yearly.</p>
        <div className="mt-8 grid gap-5 md:grid-cols-2">
          {(["alerts", "bots"] as const).map((k) => {
            const p = PLANS[k];
            const hot = k === "bots";
            return (
              <div key={k} className={`rounded-2xl border p-6 ${hot ? "border-primary bg-card" : "border-border bg-card"}`}>
                {hot && <span className="mb-2 inline-block rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground">MOST POWERFUL</span>}
                <h3 className="text-xl font-bold">{p.name}</h3>
                <p className="mt-2"><span className="text-4xl font-black">${p.monthly}</span><span className="text-muted-foreground">/mo</span></p>
                <p className="text-sm text-muted-foreground">or ${p.yearly}/year</p>
                <ul className="mt-5 space-y-2 text-sm">
                  {p.features.map((x) => <li key={x} className="flex gap-2"><Check className="h-4 w-4 shrink-0 text-primary" />{x}</li>)}
                </ul>
                <Link to="/auth" className={`mt-6 block rounded-md px-4 py-3 text-center font-semibold ${hot ? "bg-primary text-primary-foreground hover:bg-primary/90" : "border border-border hover:bg-muted"}`}>Get {p.name}</Link>
              </div>
            );
          })}
        </div>
      </section>

      <footer className="border-t border-border px-5 py-8 text-center text-xs text-muted-foreground">
        <p className="flex items-center justify-center gap-1"><Shield className="h-3 w-3" /> Educational alerts, not financial advice. Options trading involves substantial risk of loss.</p>
        <p className="mt-2">© {new Date().getFullYear()} Pulse Signals</p>
      </footer>
    </div>
  );
}
