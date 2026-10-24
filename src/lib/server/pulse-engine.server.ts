import { iwmAlpaca } from "./iwm-alpaca.server";
import { resolveBotSettings, onMark, strategyExit, positionSize, hm, etParts, bankSettle } from "@/lib/pulse-bots";
import { pulseConfigSchema, evaluatePulseBars, pulseEntryBlock } from "@/lib/pulse-bots/config";
import { freshQuote, terminalOrder } from "@/lib/iwm-engine-rules";

type Rec=Record<string,any>;
type Api=Awaited<ReturnType<typeof iwmAlpaca>>;
const cash=(v:number)=>Math.round(v*100)/100;

/** Owner-wide lease serializes separate bots; intents are checkpointed before broker submission. */
export async function runPulseOwner(db:any,userId:string,apiOverride?:Api){
  const token=crypto.randomUUID(),started=Date.now();
  const lease=await db.rpc("pulse_acquire_lease",{p_user_id:userId,p_token:token});
  if(lease.error) throw new Error("Could not acquire paper bot lease");
  if(!lease.data) return {skipped:"already running"};
  let processed=0,errors=0;
  const budget=()=>{if(Date.now()-started>37000) throw new Error("Check paused at run budget; resumes next minute");};
  try{
    const api=apiOverride??await iwmAlpaca(db,userId);
    const clock=await api.clock(),now=new Date(clock.timestamp),today=etParts(now.toISOString()).date;
    const rows=await db.from("pulse_bot_configs").select("*").eq("user_id",userId).order("created_at");
    const stored=await db.from("pulse_bot_states").select("*").eq("user_id",userId);
    if(rows.error||stored.error) throw new Error("Could not read paper bots");
    const stateMap=new Map<string,Rec>((stored.data??[]).map((r:Rec)=>[r.bot_id,r.state]));
    for(const row of rows.data??[]){
      if(Date.now()-started>33000) break;
      let state:Rec=stateMap.get(row.id)??{};
      if(!row.enabled&&!state.position&&!state.pending) continue;
      const checkpoint=async()=>{
        budget();const r=await db.rpc("pulse_checkpoint",{p_user_id:userId,p_token:token,p_bot_id:row.id,p_state:state});
        if(r.error) throw new Error("Checkpoint failed; broker intent retained for reconciliation");
      };
      const event=async(kind:string,detail:Rec)=>{
        try{const r=await db.from("pulse_bot_events").insert({bot_id:row.id,user_id:userId,kind,detail});if(r.error) console.error("Paper bot event write failed");}catch{console.error("Paper bot event write failed");}
      };
      try{
        const parsed=pulseConfigSchema.parse(row.config),s=resolveBotSettings(parsed,{isPaper:true});
        if(!state.initialized){state={...state,initialized:true,balance:parsed.allocation,bankedTotal:0,cycles:0,memo:{},lastBars:{},trades:0,pnlToday:0};}
        if(state.day!==today){state.day=today;state.dayBalance=state.balance;state.pnlToday=0;state.trades=0;state.memo={};}
        const submit=async(p:Rec)=>{
          state.pending=p;await checkpoint();budget();
          const found=await api.findOrder(p.clientId);const o=found??await api.submit(p.body);
          state.pending.id=o.id;await checkpoint();
        };
        const reconcile=async()=>{
          const p=state.pending;if(!p) return;
          let o=p.id?await api.order(p.id):await api.findOrder(p.clientId);
          if(!o){
            if(p.kind==="entry" && (!row.enabled||row.kill_switch||now.getTime()-Date.parse(p.at)>60000)){state.pending=null;await checkpoint();return;}
            budget();o=await api.submit(p.body);p.id=o.id;await checkpoint();
          }
          if(!terminalOrder(o.status)){
            if(now.getTime()-Date.parse(p.at)<60000&&!row.kill_switch) return;
            o=await api.cancel(o.id);if(!terminalOrder(o.status)) return;
          }
          const qty=Number(o.filled_qty??0),price=Number(o.filled_avg_price??0);
          if(qty>0&&price>0){
            if(p.kind==="entry"){
              state.position={...p.position,qty,entryPrice:price,peakGainPct:0,floorPct:null,openedBarTime:p.barTime,entryAt:o.filled_at??now.toISOString()};
              state.trades++;await event("entry",{symbol:p.body.symbol,qty,price,side:p.position.side,reason:p.reason,orderId:o.id});
            }else{
              const pos=state.position;if(!pos) throw new Error("Exit has no owned position; review required");
              const signed=pos.instrument==="shares"&&pos.side==="short"?-1:1;
              const pnl=cash((price-pos.entryPrice)*signed*qty*(pos.instrument==="options"?100:1));
              state.balance=cash(state.balance+pnl);state.pnlToday=cash(state.pnlToday+pnl);pos.qty-=qty;
              await event("exit",{symbol:pos.symbol,qty,price,pnl,reason:p.reason,orderId:o.id});
              if(pos.qty<=0){state.position=null;
                if(parsed.banking?.enabled){const bank={balance:state.balance,bankedTotal:state.bankedTotal,cycles:state.cycles};const amount=bankSettle(bank,0,parsed.banking.startBalance,parsed.banking.bankTrigger);Object.assign(state,bank);if(amount!==null) await event("bank",{amount,balance:bank.balance});}
              }
            }
          }
          state.pending=null;await checkpoint();
        };
        await reconcile();
        if(state.pending){state.note="Order pending reconciliation";await checkpoint();continue;}
        const positions=await api.positions();
        if(state.position){const held=positions.find(p=>p.symbol===state.position.symbol);const q=Number(held?.qty??0);if(Math.abs(q)!==state.position.qty || (state.position.instrument==="shares"&&((q<0)!==(state.position.side==="short")))) {state.review="Broker position changed outside bot; stop and review in Alpaca";state.note=state.review;await checkpoint();continue;}}
        if(!clock.is_open){state.note="Market closed";state.lastCheck=now.toISOString();await checkpoint();processed++;continue;}
        const minutes=etParts(now.toISOString()).minutes;
        const closeDate=new Date(clock.next_close),closeMinutes=etParts(closeDate.toISOString()).minutes;
        const flat=s.flatAt?Math.min(hm(s.flatAt),closeMinutes-10):null;
        async function barsFor(symbol:string){
          const days=s.timeframe===1440?750:14;
          const query=new URLSearchParams({symbols:symbol,timeframe:s.timeframe===1440?"1Day":`${s.timeframe}Min`,start:new Date(now.getTime()-days*86400000).toISOString(),end:now.toISOString(),feed:"iex",adjustment:"raw",limit:"10000",sort:"desc"});
          const r=await api.call(`/v2/stocks/bars?${query}`,"GET",undefined,true);
          return (r.bars?.[symbol]??[]).filter((b:Rec)=>{
            if(s.timeframe===1440) return etParts(b.t).date<today;
            const m=etParts(b.t).minutes;return m>=570&&m<960&&Date.parse(b.t)+s.timeframe*60000<=now.getTime();
          }).reverse();
        }
        if(state.position){
          const p=state.position;
          let quote:Rec;if(p.instrument==="options") quote=await api.quote(p.symbol,"indicative");else{const r=await api.call(`/v2/stocks/quotes/latest?${new URLSearchParams({symbols:p.symbol,feed:"iex"})}`,"GET",undefined,true);quote=r.quotes?.[p.symbol];}
          let reason=row.kill_switch?"Kill switch":!row.enabled?"Bot stopped":flat!==null&&minutes>=flat?"Session flatten":null;
          const bars=await barsFor(p.underlying),last=bars.at(-1);
          const memo=new Set<string>(state.memo[p.underlying]??[]),sig=evaluatePulseBars(bars,s,memo);
          if(freshQuote(quote,now)){
            const mark=p.instrument==="shares"&&p.side==="short"?Number(quote.ap):Number(quote.bp);
            reason??=onMark(p,mark,last?.c??null,s).exit;
            if(last) reason??=strategyExit(p,sig,last.t,s);
            p.mark=mark;
          }else if(!reason){state.note="Position quote stale; entries paused";await checkpoint();continue;}
          if(reason){
            const body={symbol:p.symbol,qty:String(p.qty),side:p.instrument==="shares"&&p.side==="short"?"buy":"sell",type:"market",time_in_force:"day",client_order_id:`pulse-${row.id.slice(0,8)}-${crypto.randomUUID().slice(0,20)}`,...(p.instrument==="options"?{position_intent:"sell_to_close"}: {})};
            await submit({kind:"exit",body,clientId:body.client_order_id,reason,at:now.toISOString()});await reconcile();
          }else state.note=sig.note;
          state.lastCheck=now.toISOString();await checkpoint();processed++;continue;
        }
        let blocked=state.review??pulseEntryBlock({enabled:row.enabled,kill:row.kill_switch,balance:state.balance,pnlToday:state.pnlToday,dayBalance:state.dayBalance,trades:state.trades,s});
        if(flat!==null&&minutes>=flat-5) blocked="Near session close";
        if(blocked){state.note=blocked;await checkpoint();continue;}
        const account=await api.account();
        if(account.trading_blocked||account.account_blocked) throw new Error("Paper account blocked");
        const openOrders=await api.call("/v2/orders?status=open&limit=500");
        for(const symbol of parsed.symbols){
          budget();const bars=await barsFor(symbol),last=bars.at(-1);if(!last){state.note="No closed market bars";continue;}
          if(state.lastBars[symbol]===last.t) continue;
          const memo=new Set<string>(state.memo[symbol]??[]),sig=evaluatePulseBars(bars,s,memo);
          state.memo[symbol]=[...memo];state.lastBars[symbol]=last.t;state.note=sig.note;
          if(!sig.entry || parsed.direction!=="both"&&parsed.direction!==sig.entry.side) continue;
          if(s.timeframe!==1440&&now.getTime()-(Date.parse(last.t)+s.timeframe*60000)>s.timeframe*60000) {state.note="Signal bar stale";continue;}
          if(parsed.executionMode!=="auto"){await event("signal",{symbol,...sig.entry,barTime:last.t,mode:parsed.executionMode});continue;}
          // Do not share an underlying with manual positions, IWM, another bot or a working order.
          const matches=(x:string)=>x===symbol||new RegExp(`^${symbol.replaceAll('.','\\.')}\\d{6}[CP]\\d{8}$`).test(x);
          const otherStates=await db.from("pulse_bot_states").select("state").eq("user_id",userId);
          const iwm=await db.from("iwm_strategy_state").select("open_trade,pending_order").eq("user_id",userId).maybeSingle();
          if(otherStates.error||iwm.error) throw new Error("Could not verify owned positions");
          if(positions.some(p=>matches(p.symbol)) || openOrders.some((o:Rec)=>matches(o.symbol)) || (otherStates.data??[]).some((r:Rec)=>r.state?.position?.underlying===symbol||r.state?.pending?.position?.underlying===symbol) || symbol==="IWM"){state.note="Underlying already held, pending, or reserved for IWM";continue;}
          const asset=await api.call(`/v2/assets/${encodeURIComponent(symbol)}`);
          if(!asset.tradable||asset.status!=="active"){state.note="Underlying not tradable";continue;}
          const side=sig.entry.side;let contract=symbol,price=last.c,quote:Rec;
          if(parsed.instrument==="options"){
            if(Number(account.options_trading_level)<2){state.note="Options approval required";continue;}
            const expiry=new Date(Date.parse(`${today}T12:00:00Z`)+s.optionDte*86400000).toISOString().slice(0,10);
            const r=await api.call(`/v2/options/contracts?${new URLSearchParams({underlying_symbols:symbol,type:side==="long"?"call":"put",expiration_date_gte:expiry,expiration_date_lte:new Date(Date.parse(`${expiry}T12:00:00Z`)+7*86400000).toISOString().slice(0,10),status:"active",limit:"1000"})}`);
            const candidates=(r.option_contracts??[]).filter((c:Rec)=>c.tradable).sort((a:Rec,b:Rec)=>a.expiration_date.localeCompare(b.expiration_date)||Math.abs(Number(a.strike_price)-last.c)-Math.abs(Number(b.strike_price)-last.c));
            const first=candidates[0];if(!first){state.note="No supported option contracts";continue;}
            const strikes=candidates.filter((c:Rec)=>c.expiration_date===first.expiration_date).sort((a:Rec,b:Rec)=>Number(a.strike_price)-Number(b.strike_price));
            const idx=strikes.findIndex((c:Rec)=>c.symbol===first.symbol),selected=strikes[Math.max(0,Math.min(strikes.length-1,idx+(side==="long"?1:-1)*s.strikeOffset))];
            if(!selected) continue;contract=selected.symbol;quote=await api.quote(contract,"indicative");price=Number(quote?.ap);
          }else{
            if(side==="short"&&(!asset.shortable||!account.shorting_enabled)){state.note="Short selling unavailable";continue;}
            const r=await api.call(`/v2/stocks/quotes/latest?${new URLSearchParams({symbols:symbol,feed:"iex"})}`,"GET",undefined,true);quote=r.quotes?.[symbol];price=Number(side==="short"?quote?.bp:quote?.ap);
          }
          if(!freshQuote(quote,now)||!(price>0)){state.note="Fresh quote unavailable";continue;}
          const qty=Math.min(parsed.instrument==="options"?50:10000,positionSize(state.balance,price,s));
          const cost=qty*price*(parsed.instrument==="options"?100:1),buyingPower=Number(parsed.instrument==="options"?account.options_buying_power:account.buying_power);
          if(qty<1||cost>buyingPower){state.note="Allocation or buying power too small";continue;}
          const body={symbol:contract,qty:String(qty),side:parsed.instrument==="shares"&&side==="short"?"sell":"buy",type:"limit",limit_price:price.toFixed(2),time_in_force:"day",client_order_id:`pulse-${row.id.slice(0,8)}-${crypto.randomUUID().slice(0,20)}`,...(parsed.instrument==="options"?{position_intent:"buy_to_open"}: {})};
          await submit({kind:"entry",body,clientId:body.client_order_id,at:now.toISOString(),barTime:last.t,reason:sig.entry.reason,position:{symbol:contract,underlying:symbol,instrument:parsed.instrument,side,underlyingStop:sig.entry.stop,underlyingTarget:sig.entry.target}});
          await reconcile();break;
        }
        state.lastCheck=now.toISOString();await checkpoint();processed++;
      }catch(e){errors++;const message=e instanceof Error?e.message:"Paper bot check failed";state.note=message;try{await checkpoint();}catch{}await event("error",{message});}
    }
    return {processed,errors,paper:true};
  }finally{
    await db.from("pulse_bot_leases").update({token:null,lease_until:null}).eq("user_id",userId).eq("token",token);
  }
}

export async function runPulseScheduled(){
  const {supabaseAdmin:db}=await import("@/integrations/supabase/client.server");
  const r=await db.from("pulse_bot_configs").select("user_id");if(r.error) throw new Error("Could not load bot owners");
  const results=[];for(const id of new Set((r.data??[]).map(b=>b.user_id))){try{results.push(await runPulseOwner(db,id));}catch{results.push({errors:1});}}
  return {owners:results.length,results};
}