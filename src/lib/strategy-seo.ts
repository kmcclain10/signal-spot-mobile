import { PLAYBOOK } from "@/lib/strategy-platform";
import { publicStrategy } from '@/lib/public-strategies';

export const SITE = "https://thesignalspot.com";
export const tfLabel = (m: number) => (m >= 1440 ? "daily" : `${m}-minute`);
export const strategySlug = (id: string) => id.replace(/_/g, "-");
export const findStrategy = (slug: string) => PLAYBOOK.find((s) => strategySlug(s.id) === slug);
export const strategyTitle = (s: (typeof PLAYBOOK)[number]) =>
  `${s.name} Strategy — ${tfLabel(s.timeframe)} chart alerts | The Signal Spot`;
export const strategyDescription = (s: (typeof PLAYBOOK)[number]) =>
  `${publicStrategy(s.id)?.summary ?? s.summary} Learn the published ${s.name} rules on the ${tfLabel(s.timeframe)} chart. Educational alerts, not investment advice.`.slice(0, 300);
