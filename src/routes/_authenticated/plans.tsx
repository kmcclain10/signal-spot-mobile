import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, Panel } from "@/components/common";
import { Button } from "@/components/ui/button";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { PLANS, priceIdFor, type BillingCycle, type PlanTier } from "@/lib/plans";
import { createCheckoutSession, createPortalSession } from "@/lib/payments.functions";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { usePlan } from "@/hooks/use-plan";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/plans")({
  validateSearch: (s: Record<string, unknown>): { checkout?: string } => ({
    checkout: typeof s.checkout === "string" ? s.checkout : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Plans — Pulse Signals" },
      { name: "description", content: "Choose Alerts Only or Full AI Bot Assistance for Pulse Signals." },
      { property: "og:title", content: "Plans — Pulse Signals" },
      { property: "og:description", content: "Alerts from $49/mo or full AI bots from $99/mo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PlansPage,
});

function Checkout({ priceId }: { priceId: string }) {
  const create = useServerFn(createCheckoutSession);
  const fetchClientSecret = async () => {
    const r = await create({ data: { priceId, environment: getStripeEnvironment(), returnUrl: `${window.location.origin}/plans?checkout=done` } });
    if ("error" in r) throw new Error(r.error);
    return r.clientSecret;
  };
  return (
    <EmbeddedCheckoutProvider stripe={getStripe()} options={{ fetchClientSecret }}>
      <EmbeddedCheckout />
    </EmbeddedCheckoutProvider>
  );
}

function PlansPage() {
  const { checkout } = Route.useSearch();
  const plan = usePlan();
  const qc = useQueryClient();
  const portal = useServerFn(createPortalSession);
  const [cycle, setCycle] = useState<BillingCycle>("monthly");
  const [selected, setSelected] = useState<string | null>(null);
  const tier = plan.data?.tier ?? null;

  const manage = async () => {
    try {
      const r = await portal({ data: { environment: getStripeEnvironment(), returnUrl: window.location.href } });
      if ("error" in r) throw new Error(r.error);
      window.open(r.url, "_blank");
    } catch (e) { toast.error((e as Error).message); }
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Plans" sub={tier ? `Current plan: ${PLANS[tier].name}${plan.data?.complimentary ? " (complimentary)" : ""}` : "Pick a plan to unlock alerts or bots."}
        action={plan.data?.subscription ? <Button variant="outline" onClick={manage}>Manage billing</Button> : undefined} />
      <PaymentTestModeBanner />
      {checkout === "done" && (
        <Panel className="rounded-lg border p-4 text-sm">
          Thanks! Your plan activates within a few seconds.{" "}
          <button className="underline" onClick={() => qc.invalidateQueries({ queryKey: ["my-plan"] })}>Refresh</button>
        </Panel>
      )}

      {selected ? (
        <div className="space-y-3">
          <Button variant="ghost" onClick={() => setSelected(null)}>← Back to plans</Button>
          <div className="overflow-hidden rounded-lg bg-background"><Checkout priceId={selected} /></div>
        </div>
      ) : (
        <>
          <div className="inline-flex rounded-full border p-1">
            {(["monthly", "yearly"] as const).map((c) => (
              <button key={c} onClick={() => setCycle(c)}
                className={cn("rounded-full px-4 py-1.5 text-sm", cycle === c ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>
                {c === "monthly" ? "Monthly" : "Yearly · 2 months free"}
              </button>
            ))}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {(Object.keys(PLANS) as PlanTier[]).map((t) => {
              const p = PLANS[t];
              const current = tier === t;
              return (
                <Panel key={t} className={cn("flex flex-col rounded-xl border p-5", t === "bots" && "border-primary")}>
                  <h2 className="text-lg font-semibold">{p.name}</h2>
                  <p className="mt-2"><span className="num text-3xl font-semibold">${cycle === "monthly" ? p.monthly : p.yearly}</span>
                    <span className="text-sm text-muted-foreground">/{cycle === "monthly" ? "mo" : "yr"}</span></p>
                  <ul className="my-4 flex-1 space-y-2 text-sm">
                    {p.features.map((f) => <li key={f} className="flex gap-2"><Check className="h-4 w-4 text-primary" />{f}</li>)}
                  </ul>
                  <Button disabled={current || (tier === "bots" && t === "alerts")} onClick={() => {
                    try { getStripeEnvironment(); setSelected(priceIdFor(t, cycle)); } catch (e) { toast.error((e as Error).message); }
                  }}>
                    {current ? "Current plan" : tier === "alerts" && t === "bots" ? "Upgrade" : "Subscribe"}
                  </Button>
                </Panel>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
