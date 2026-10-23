import { decryptJson } from "@/lib/server/providers.server";
import { requireIwmPaper, freshQuote } from "@/lib/iwm-engine-rules";
import { etParts, type Side, type Bar, type StrategyConfig } from "@/lib/iwmWindowStrategy";
import { optionContractParams } from "@/lib/trade-rules";

type Rec = Record<string, any>;
export class IwmAlpacaError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export async function iwmAlpaca(db: any, userId: string, connectionId?: string) {
  let query = db.from("connections").select("*").eq("user_id", userId).eq("provider", "alpaca").eq("environment", "paper");
  if (connectionId) query = query.eq("id", connectionId);
  const { data, error } = await query.order("is_default_broker", {ascending:false}).order("created_at").limit(1);
  if (error) throw new Error("Could not read the paper connection");
  const conn = data?.[0];
  if (!conn) throw new Error("Add an Alpaca paper connection before enabling IWM automation");
  const base = requireIwmPaper(conn);
  const secrets = await decryptJson(conn.secret_cipher, conn.secret_iv);
  if (!secrets.key_id || !secrets.secret_key) throw new Error("Paper connection has no saved credentials");
  const headers = {"APCA-API-KEY-ID": secrets.key_id,"APCA-API-SECRET-KEY": secrets.secret_key,"Content-Type":"application/json"};
  const call = async (path: string, method = "GET", body?: Rec, marketData = false): Promise<any> => {
    try {
      const response = await fetch((marketData ? "https://data.alpaca.markets" : base) + path, {
        method, headers, ...(body ? {body:JSON.stringify(body)} : {}), signal:AbortSignal.timeout(5000),
      });
      if (!response.ok) {
        // Broker bodies can contain account information; never echo or log them.
        await response.body?.cancel();
        throw new IwmAlpacaError(response.status, `Alpaca ${method} ${path.split("?")[0]} failed (${response.status})`);
      }
      return response.status === 204 ? null : await response.json();
    } catch (error) {
      if (error instanceof IwmAlpacaError) throw error;
      throw new Error(`Alpaca ${method} ${path.split("?")[0]} timed out or could not be reached`);
    }
  };
  async function pages(path: string, params: Record<string,string>, key: string, marketData = false): Promise<any[]> {
    const out: any[] = []; let token: string | undefined;
    for (let n=0;n<20;n++) {
      const query = new URLSearchParams({...params,...(token ? {page_token:token}: {})});
      const result = await call(`${path}?${query}`,"GET",undefined,marketData);
      const values = key === "bars" ? result.bars?.IWM ?? [] : result[key] ?? [];
      out.push(...(Array.isArray(values) ? values : Object.entries(values).map(([symbol,snapshot]) => ({symbol,...snapshot as Rec}))));
      token = result.next_page_token;
      if (!token) return out;
    }
    throw new Error("Alpaca pagination exceeded the safe run budget; no order submitted");
  }
  async function chooseContract(side: Side, spot: number, today: string, feed: string, now: Date, underlying = "IWM") {
    const end = new Date(Date.parse(`${today}T12:00:00Z`) + 14*86400000).toISOString().slice(0,10);
    const contracts = await pages("/v2/options/contracts", optionContractParams(underlying, side, spot, today, end),"option_contracts");
    const expiries = [...new Set<string>(contracts.filter(c=>c.tradable).map(c=>String(c.expiration_date)))].sort();
    for (const expiry of expiries) {
      const candidates = contracts.filter(c=>c.tradable && c.expiration_date === expiry).sort((a,b)=>Math.abs(+a.strike_price-spot)-Math.abs(+b.strike_price-spot));
      for (let i=0;i<candidates.length;i+=100) {
        const chunk = candidates.slice(i,i+100);
        const snapshots = await pages("/v1beta1/options/snapshots", {symbols:chunk.map(c=>c.symbol).join(","),feed,limit:"1000"},"snapshots",true);
        const quotes = new Map(snapshots.map(s=>[s.symbol,s.latestQuote]));
        const selected = chunk.find(c=>freshQuote(quotes.get(c.symbol),now));
        if (selected) return {symbol:selected.symbol,strike:+selected.strike_price,expiry,ask:+quotes.get(selected.symbol).ap,bid:+quotes.get(selected.symbol).bp};
      }
    }
    return null;
  }
  return {
    connectionId:conn.id,
    /** Generic paper-only broker call for the manual Trade desk. */
    call,
    clock:()=>call("/v2/clock"),
    account:()=>call("/v2/account"),
    positions:async():Promise<any[]>=>(await call("/v2/positions")) ?? [],
    /** Most recent sell fill for a symbol, used when a position closed outside the bot. */
    async lastSellFill(symbol:string) {
      const fills:any[] = (await call(`/v2/account/activities/FILL?${new URLSearchParams({direction:"desc",page_size:"100"})}`)) ?? [];
      return fills.find(f=>f.symbol===symbol && f.side==="sell") ?? null;
    },
    async bars(cfg:StrategyConfig, feed:string, now:Date):Promise<Bar[]> {
      return pages("/v2/stocks/bars",{symbols:"IWM",timeframe:`${cfg.timeframeMin}Min`,start:new Date(now.getTime()-3*86400000).toISOString(),end:now.toISOString(),feed,adjustment:"raw",limit:"10000",sort:"asc"},"bars",true);
    },
    chooseContract,
    async quote(symbol:string,feed:string) {
      const result = await call(`/v1beta1/options/quotes/latest?${new URLSearchParams({symbols:symbol,feed})}`,"GET",undefined,true);
      return result.quotes?.[symbol];
    },
    order:(id:string)=>call(`/v2/orders/${encodeURIComponent(id)}`),
    async findOrder(clientId:string) {
      try { return await call(`/v2/orders:by_client_order_id?${new URLSearchParams({client_order_id:clientId})}`); }
      catch(e) { if (e instanceof IwmAlpacaError && e.status===404) return null; throw e; }
    },
    submit:async(body:Rec)=> {
      requireIwmPaper(conn);
      return call("/v2/orders","POST",body);
    },
    async cancel(id:string) {
      try { await call(`/v2/orders/${encodeURIComponent(id)}`,"DELETE"); }
      catch(e) { if (!(e instanceof IwmAlpacaError && e.status===422)) throw e; }
      // A DELETE is not proof of cancellation. Always reconcile the final broker state.
      return call(`/v2/orders/${encodeURIComponent(id)}`);
    },
    async verify(cfg:StrategyConfig,stockFeed:string,optionFeed:string) {
      const clock = await call("/v2/clock"), now = new Date(clock.timestamp);
      const account = await call("/v2/account");
      const bars = await pages("/v2/stocks/bars",{symbols:"IWM",timeframe:`${cfg.timeframeMin}Min`,start:new Date(now.getTime()-3*86400000).toISOString(),end:now.toISOString(),feed:stockFeed,adjustment:"raw",limit:"10000"},"bars",true);
      const last = bars[bars.length-1];
      const contract = last ? await chooseContract("CALL",last.c,etParts(now.toISOString()).date,optionFeed,now) : null;
      return {paper:true, marketOpen:!!clock.is_open, optionsLevel:Number(account.options_trading_level ?? 0), bars:bars.length, optionQuotes:!!contract, discordConfigured:!!process.env["DISCORD_WEBHOOK_URL"]};
    },
  };
}