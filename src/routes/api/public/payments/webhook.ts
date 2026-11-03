import { createFileRoute } from "@tanstack/react-router";
import { type StripeEnv, verifyWebhook } from "@/lib/stripe.server";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

function priceKey(item: any): string {
  return item?.price?.lookup_key || item?.price?.metadata?.lovable_external_id || item?.price?.id;
}
const iso = (s?: number) => (s ? new Date(s * 1000).toISOString() : null);

/** Turn bots off when the user no longer has the AI Bots plan. */
async function enforceBots(userId: string | undefined) {
  if (!userId) return;
  const db = await admin();
  const { data: tier } = await db.rpc("plan_tier", { _user_id: userId });
  if (tier === "bots") return;
  await db.from("pulse_bot_configs").update({ enabled: false }).eq("user_id", userId).eq("enabled", true);
  await db.from("iwm_strategy_settings").update({ enabled: false }).eq("user_id", userId).eq("enabled", true);
}

async function upsertSub(sub: any, env: StripeEnv) {
  const userId = sub.metadata?.userId;
  if (!userId) { console.error("No userId in subscription metadata"); return; }
  const item = sub.items?.data?.[0];
  const db = await admin();
  await db.from("subscriptions").upsert({
    user_id: userId,
    stripe_subscription_id: sub.id,
    stripe_customer_id: typeof sub.customer === "string" ? sub.customer : sub.customer?.id,
    product_id: typeof item?.price?.product === "string" ? item.price.product : item?.price?.product?.id ?? "",
    price_id: priceKey(item),
    status: sub.status,
    current_period_start: iso(item?.current_period_start ?? sub.current_period_start),
    current_period_end: iso(item?.current_period_end ?? sub.current_period_end),
    cancel_at_period_end: sub.cancel_at_period_end || false,
    environment: env,
    updated_at: new Date().toISOString(),
  }, { onConflict: "stripe_subscription_id" });
  await enforceBots(userId);
}

async function deleteSub(sub: any, env: StripeEnv) {
  const db = await admin();
  await db.from("subscriptions").update({ status: "canceled", updated_at: new Date().toISOString() })
    .eq("stripe_subscription_id", sub.id).eq("environment", env);
  await enforceBots(sub.metadata?.userId);
}

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawEnv = new URL(request.url).searchParams.get("env");
        if (rawEnv !== "sandbox" && rawEnv !== "live") return Response.json({ received: true, ignored: "invalid env" });
        const env: StripeEnv = rawEnv;
        try {
          const event = await verifyWebhook(request, env);
          switch (event.type) {
            case "customer.subscription.created":
            case "customer.subscription.updated":
              await upsertSub(event.data.object, env); break;
            case "customer.subscription.deleted":
              await deleteSub(event.data.object, env); break;
            default:
              console.log("Unhandled event:", event.type);
          }
          return Response.json({ received: true });
        } catch (e) {
          console.error("Webhook error:", e);
          return new Response("Webhook error", { status: 400 });
        }
      },
    },
  },
});
