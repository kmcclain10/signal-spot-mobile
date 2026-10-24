// Pulse Bots strategy library — import everything from here.
//   import { STRATEGIES, getStrategy, resolveBotSettings, onMark, strategyExit, positionSize } from "../_shared/bots/index.ts";
export * from "./indicators.ts";
export * from "./strategies.ts";
export * from "./risk.ts";
export { settle, occSymbol, protectedFloor } from "./window20Core.ts";
export type { BankState } from "./window20Core.ts";

import { STRATEGIES } from "./strategies.ts";
import { DEFAULT_CONFIG, settle as w20settle } from "./window20Core.ts";
import type { BankState } from "./window20Core.ts";

/** Banking rule for any bot: apply P&L; at/above bankTrigger, bank everything above startBalance and restart. */
export function bankSettle(bank: BankState, pnl: number, startBalance: number, bankTrigger: number): number | null {
  return w20settle(bank, pnl, { ...DEFAULT_CONFIG, startingBankroll: startBalance, bankTrigger });
}
import { RISK_LEVELS } from "./risk.ts";

/** Catalog for the UI and the AI agent: everything a screen needs to render bot cards and settings. */
export function strategyCatalog() {
  return STRATEGIES.map((s) => ({
    id: s.id, botName: s.botName, name: s.name, category: s.category, style: s.style, summary: s.summary, rules: s.rules,
    timeframes: s.timeframes, defaultTimeframe: s.defaultTimeframe,
    params: s.params.map(({ key, label, min, max, step, presets, help }) => ({ key, label, min, max, step, help,
      defaults: { conservative: presets[0], balanced: presets[1], aggressive: presets[2], test: presets[3] } })),
  }));
}
export const riskCatalog = () => RISK_LEVELS;
