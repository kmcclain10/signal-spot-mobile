import { PLAYBOOK } from "@/lib/strategy-platform";

export const SITE = "https://thesignalspot.com";
export const tfLabel = (m: number) => (m >= 1440 ? "daily" : `${m}-minute`);
export const strategySlug = (id: string) => id.replace(/_/g, "-");
export const findStrategy = (slug: string) => PLAYBOOK.find((s) => strategySlug(s.id) === slug);
export const strategyTitle = (s: (typeof PLAYBOOK)[number]) =>
  `${s.name} Strategy — ${tfLabel(s.timeframe)} chart alerts | Pulse Signals`;
export const strategyDescription = (s: (typeof PLAYBOOK)[number]) =>
  `${s.summary} Learn the exact ${s.name} entry and exit rules on the ${tfLabel(s.timeframe)} chart and get real-time call and put alerts.`.slice(0, 300);
