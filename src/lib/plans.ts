export type PlanTier = "alerts" | "bots";
export type BillingCycle = "monthly" | "yearly";

export const PLANS: Record<PlanTier, { name: string; monthly: number; yearly: number; features: string[] }> = {
  alerts: {
    name: "Alerts Only",
    monthly: 49,
    yearly: 490,
    features: ["Real-time setup alerts", "Signal feed & breakout triggers", "Discord / Telegram & push alerts", "No automated orders"],
  },
  bots: {
    name: "Full AI Bot Assistance",
    monthly: 99,
    yearly: 990,
    features: ["Everything in Alerts", "IWM strategy bot", "All Pulse bots", "Automated entries, exits & profit locks"],
  },
};

export function priceIdFor(tier: PlanTier, cycle: BillingCycle): string {
  return `${tier}_${cycle}`;
}

/** Maps a stored price id to its tier. Unknown ids grant nothing. */
export function tierFromPriceId(priceId: string | null | undefined): PlanTier | null {
  if (!priceId) return null;
  if (priceId.startsWith("bots_")) return "bots";
  if (priceId.startsWith("alerts_")) return "alerts";
  return null;
}

export function canRunBots(tier: PlanTier | null): boolean {
  return tier === "bots";
}
