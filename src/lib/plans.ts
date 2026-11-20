export type PlanTier = "alerts" | "bots";
export type BillingCycle = "monthly" | "yearly";

export const PLANS: Record<PlanTier, { name: string; monthly: number; yearly: number; features: string[] }> = {
  alerts: {
    name: "Alerts Only",
    monthly: 49,
    yearly: 490,
    features: ["Rule-based setup alerts in the member feed", "Signal feed & breakout triggers", "Optional browser notifications while the app is open", "No automated orders"],
  },
  bots: {
    name: "Full AI Bot Assistance",
    monthly: 99,
    yearly: 990,
    features: ["Everything in Alerts", "IWM strategy bot in your selected paper or live account", "All 10 additional Pulse bots (paper-only)", "Optional automated entries and exits following published rules, plus trailing exits where provided"],
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
