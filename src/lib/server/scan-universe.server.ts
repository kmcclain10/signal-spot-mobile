import { parseMarketCapCompanies } from '@/lib/alert-preferences';
export const MARKET_CAP_SOURCE = 'https://companiesmarketcap.com/usa/largest-companies-in-the-usa-by-market-cap/';
export async function loadScanUniverse(db:any, api:any, now:Date) {
  const saved = await db.from('strategy_scan_universe').select('*').eq('id','us_market_cap').maybeSingle();
  if(saved.error) throw new Error('Could not read scan markets');
  if(saved.data && now.getTime()-Date.parse(saved.data.refreshed_at)<86400000) return saved.data;
  try {
    const response = await fetch(MARKET_CAP_SOURCE,{signal:AbortSignal.timeout(5000)});
    if(!response.ok) throw new Error('Market-cap ranking unavailable');
    const ranked = parseMarketCapCompanies(await response.text());
    const assets:any[] = await api.call('/v2/assets?status=active&asset_class=us_equity');
    const tradable = new Set(assets.filter(a=>a.tradable).map(a=>a.symbol));
    const companies = ranked.filter(c=>tradable.has(c.symbol)).slice(0,10);
    if(companies.length!==10) throw new Error('Incomplete market-cap ranking');
    const row={id:'us_market_cap',symbols:companies.map(c=>c.symbol),companies,source_url:MARKET_CAP_SOURCE,refreshed_at:now.toISOString()};
    const write=await db.from('strategy_scan_universe').upsert(row);
    if(write.error) throw new Error('Could not save scan markets');
    return row;
  } catch(error) {
    // Retain the last verified ranking, never invent companies or market values.
    if(saved.data) return saved.data;
    throw error;
  }
}