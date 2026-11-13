import { describe,it,expect,vi } from 'vitest';
import { loadScanUniverse } from '@/lib/server/scan-universe.server';
describe('verified top-ten scan universe',()=>{
  it('takes ten tradable companies in market-cap order, skipping unavailable companies',async()=>{
    const symbols=['AAPL','NVDA','MSFT','GOOG','AMZN','SPCX','AVGO','META','TSLA','LLY','WMT'];
    vi.stubGlobal('fetch',vi.fn(async()=>new Response(symbols.map(symbol=>`<tr><div class="company-name">${symbol}</div><div class="company-code">${symbol}</div></tr>`).join(''))));
    const upsert=vi.fn(async()=>({error:null}));
    const q:any={select:()=>q,eq:()=>q,maybeSingle:async()=>({data:null,error:null}),upsert};
    const api={call:vi.fn(async()=>symbols.map(symbol=>({symbol,tradable:symbol!=='SPCX'})))};
    try {
      const r=await loadScanUniverse({from:()=>q},api,new Date('2026-11-13T04:15:00Z'));
      expect(r.symbols).toEqual(['AAPL','NVDA','MSFT','GOOG','AMZN','AVGO','META','TSLA','LLY','WMT']);
      expect(upsert).toHaveBeenCalled();
    } finally {vi.unstubAllGlobals();}
  });
});