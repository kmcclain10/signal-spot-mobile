import { z } from 'zod';
import { PLAYBOOK } from './strategy-platform';

export const CORE_SCAN_SYMBOLS = ['SPY', 'IWM', 'QQQ'];
const strategy = z.string().refine(id => PLAYBOOK.some(s => s.id === id), 'Choose an available strategy');
export const alertPreferencesSchema = z.object({
  automatic_enabled: z.boolean(),
  strategy_ids: z.array(strategy).refine(ids => new Set(ids).size === ids.length, 'Duplicate strategies'),
  custom_rules: z.array(z.object({
    strategy_id: strategy,
    symbols: z.array(z.string().trim().toUpperCase().regex(/^[A-Z][A-Z0-9.-]{0,9}$/)).min(1),
    direction: z.enum(['both', 'long', 'short']),
    enabled: z.boolean(),
  })),
});
export type AlertPreferences = z.infer<typeof alertPreferencesSchema>;
export const defaultAlertPreferences = (): AlertPreferences => ({automatic_enabled:true, strategy_ids:PLAYBOOK.map(s=>s.id),custom_rules:[]});
export function scanSelections(p: AlertPreferences, companies: string[]) {
  const result = new Map<string, {strategy_id:string;symbol:string;direction:'both'|'long'|'short'}>();
  if(p.automatic_enabled) for(const id of p.strategy_ids) for(const symbol of [...CORE_SCAN_SYMBOLS,...companies]) result.set(`${id}|${symbol}|both`,{strategy_id:id,symbol,direction:'both'});
  for(const r of p.custom_rules) if(r.enabled) for(const symbol of r.symbols) result.set(`${r.strategy_id}|${symbol}|${r.direction}`,{strategy_id:r.strategy_id,symbol,direction:r.direction});
  return [...result.values()];
}
/** Ranking rows contain one company, not one entry per share class. */
export function parseMarketCapCompanies(html: string) {
  return [...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/g)].flatMap(row=>{
    const symbol = row[1].match(/class="company-code"[^>]*>([\s\S]*?)<\/div>/)?.[1].replace(/<[^>]*>/g,'').trim();
    const name = row[1].match(/class="company-name"[^>]*>([^<]*)<\/div>/)?.[1];
    return symbol && name && /^[A-Z][A-Z0-9.-]{0,9}$/.test(symbol) ? [{symbol,name}] : [];
  });
}