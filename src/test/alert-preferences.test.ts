import { describe,it,expect } from 'vitest';
import { scanSelections,defaultAlertPreferences,alertPreferencesSchema,parseMarketCapCompanies } from '@/lib/alert-preferences';
describe('personal alert rules',()=>{
  it('automatically scans SPY, IWM, QQQ and ten companies for all eleven strategies',()=>{
    const companies=['AAPL','NVDA','MSFT','GOOG','AMZN','AVGO','META','TSLA','LLY','WMT'];
    const checks=scanSelections(defaultAlertPreferences(),companies);
    expect(checks).toHaveLength(143);
    expect(new Set(checks.map(c=>c.symbol))).toEqual(new Set(['SPY','IWM','QQQ',...companies]));
  });
  it('allows personal strategy and symbol selections independent of automatic scans',()=>{
    const p=defaultAlertPreferences();p.automatic_enabled=false;
    p.custom_rules=[{strategy_id:'scalpers',symbols:['AMD'],direction:'short',enabled:true},{strategy_id:'orb',symbols:['NFLX'],direction:'both',enabled:false}];
    expect(scanSelections(p,[])).toEqual([{strategy_id:'scalpers',symbol:'AMD',direction:'short'}]);
  });
  it('restricts selections to executable strategies and normalizes symbols',()=>{
    expect(alertPreferencesSchema.safeParse({...defaultAlertPreferences(),strategy_ids:['fake']}).success).toBe(false);
    const p=alertPreferencesSchema.parse({...defaultAlertPreferences(),custom_rules:[{strategy_id:'iwm',symbols:[' amd '],direction:'both',enabled:true}]});
    expect(p.custom_rules[0].symbols).toEqual(['AMD']);
  });
  it('parses company rankings without fabricating a ticker',()=>{
    expect(parseMarketCapCompanies('<tr><div class="company-name">Apple</div><div class="company-code"><span></span>AAPL</div></tr><tr>missing</tr>')).toEqual([{symbol:'AAPL',name:'Apple'}]);
  });
});