import { addIndicators, contractsFor, settle, etParts, type StrategyConfig } from "@/lib/iwmWindowStrategy";
import { closedRegularBars, freshQuote, terminalOrder, forceExitMinutes, sessionEndMinutes, entryBlock, positionMismatch, iwmWindowExitAt } from "@/lib/iwm-engine-rules";
import { iwmAlpaca } from "@/lib/server/iwm-alpaca.server";
import { iwmDiscord } from "@/lib/server/iwm-discord.server";
import { iwmConfigFor } from '@/lib/iwm-config';
import { crossEntry, profitAction, profitableReversal, emaCloseBreak, savingsAmount, IWM_SAVINGS_SYMBOL } from '@/lib/iwm-trade-policy';

type Rec = Record<string, any>;
type Api = Awaited<ReturnType<typeof iwmAlpaca>>;
export function configFor(settings:Rec):StrategyConfig {
  return iwmConfigFor(settings);
}
const money = (n:number)=>Math.round(n*100)/100;
const record = (values:Rec)=>({id:crypto.randomUUID(),created_at:new Date().toISOString(),...values});

/** One user's run. Injectable broker is used only by unit tests, not exposed over HTTP. */
export async function runIwmUser(db:any,settings:Rec,apiOverride?:Api) {
  const userId = settings.user_id, token = crypto.randomUUID();
  const {data:locks,error:lockError} = await db.rpc("iwm_acquire_lock",{p_user_id:userId,p_token:token});
  if (lockError) throw new Error("IWM run lock could not be acquired");
  const state:Rec = locks?.[0];
  if (!state) return {skipped:"already running"};
  let events:Rec = {}, notifications:{type:string;body:string}[] = [];
  const cfg = configFor(settings);
  const started = Date.now();
  const deadline = () => { if (Date.now()-started>38000) throw new Error("IWM run time budget reached; safely resume next run"); };
  async function checkpoint() {
    const {error} = await db.rpc("iwm_save_state",{p_user_id:userId,p_token:token,p_state:state,p_events:events});
    if (error) throw new Error("IWM checkpoint failed; order intent will be reconciled next run");
    events = {};
  }
  const event = (kind:string,row:Rec)=> { (events[kind] ??= []).push(row); };
  const note = (type:string,body:string)=>notifications.push({type,body});
  let ok=false, runError:string|null=null;
  const errorRows:Rec[]=[];
  const logError=(where:string,message:string,payload?:Rec)=>errorRows.push({user_id:userId,where,message,payload:payload ?? null});
  let api:Api;
  let now:Date;
  async function submitIntent(pending:Rec) {
    state.pending_order = pending;
    await checkpoint(); // Write-before-submit. Broker client ID survives any crash or timeout.
    deadline();
    const found = await api.findOrder(pending.client_id);
    const order = found ?? await api.submit(pending.body);
    state.pending_order.id = order.id;
    await checkpoint();
  }
  async function finishTrade(exit:number,reason:string,orderId:string|null,exitTime:string,underlying:number|null) {
    const t = state.open_trade;
    const pnl = money((exit-t.entryPremium)*100*t.contracts - cfg.feePerContract*2*t.contracts);
    const bank={balance:Number(state.balance),bankedTotal:Number(state.banked_total),cycles:Number(state.cycles)};
    const banked = settle(bank,pnl,cfg);
    Object.assign(state,{balance:bank.balance,banked_total:bank.bankedTotal,cycles:bank.cycles,pnl_today:money(Number(state.pnl_today)+pnl),
      wins_today:Number(state.wins_today)+(pnl>0 ? 1:0),losses_today:Number(state.losses_today)+(pnl<0 ? 1:0)});
    const gain=(exit/t.entryPremium-1)*100;
    event("trades",{...t.tradeRow,exit_time:exitTime,exit_premium:exit,exit_underlying:underlying,
      peak_premium:t.peakPremium,peak_gain_pct:(t.peakPremium/t.entryPremium-1)*100,final_floor_pct:t.floorPct,gain_pct:gain,pnl,exit_reason:reason,
      bankroll_after:state.balance,alpaca_exit_order_id:orderId,status:"closed"});
    if (banked !== null) {
      state.banked_today=money(Number(state.banked_today)+banked);
      event("banks",record({amount_banked:banked,banked_total:bank.bankedTotal,restart_balance:bank.balance,new_cycle:bank.cycles}));
      note("BANKED",`$${banked.toFixed(2)} banked in strategy journal • restart $${bank.balance.toFixed(2)}`);
    }
    note("EXIT",`IWM $${t.strike} ${t.side} • ${gain.toFixed(1)}% • P&L $${pnl.toFixed(2)} • ${reason}`);
    state.open_trade=null;state.pending_order=null; await checkpoint();
  }
  /** Alpaca is the source of truth: close trades that vanished and stop entries on unknown positions. */
  async function reconcileBroker() {
    if (!api.positions) return;
    const mismatch=positionMismatch(state,await api.positions());
    if (!mismatch) return;
    if (mismatch.kind==="missing") {
      const fill=await api.lastSellFill(mismatch.symbol);
      if (fill && Number(fill.price)>0 && Date.parse(fill.transaction_time)>=Date.parse(state.open_trade.tradeRow.entry_time)) {
        const t=state.open_trade;
        const average=(Number(t.exitValue ?? 0)+Number(fill.price)*(t.contracts-Number(t.exitFilledQty ?? 0)))/t.contracts;
        await finishTrade(average,"reconciled",fill.order_id ?? null,fill.transaction_time,t.liveUnderlying ?? null);
        return;
      }
      state.needs_review=`Bot shows ${mismatch.symbol} open but Alpaca has no position or sell fill`;
    } else {
      state.needs_review=`Alpaca holds ${mismatch.symbol}, which the bot did not open`;
    }
    logError("reconcile",state.needs_review,{symbol:mismatch.symbol});
    note("ERROR",state.needs_review); await checkpoint();
  }
  async function reconcile() {
    const p = state.pending_order;
    if (!p) return;
    const buyDeadline = p.side === 'buy' ? iwmWindowExitAt(p.signal?.barTime, cfg, p.signal?.window) : null;
    const windowExpired = buyDeadline !== null && now.getTime() >= buyDeadline;
    let order = p.id ? await api.order(p.id) : await api.findOrder(p.client_id);
    if (!order) {
      // If the entry intent outlived its signal, do not enter on stale data.
      if (p.side === "buy" && (windowExpired || now.getTime()-Date.parse(p.submitted_at)>60000)) {
        state.pending_order=null; await checkpoint(); return;
      }
      order = await api.submit(p.body);
      p.id=order.id; await checkpoint();
    }
    if (!terminalOrder(order.status)) {
      const age = now.getTime()-Date.parse(p.submitted_at);
      // Kill switch cancels a working entry immediately.
      if (age < (p.side === "buy" ? 60000 : 30000) && !(p.side==="buy" && (settings.kill_switch || windowExpired))) return;
      order = await api.cancel(order.id);
      if (!terminalOrder(order.status)) return;
    }
    const filledQty = Number(order.filled_qty || 0), premium = Number(order.filled_avg_price || 0);
    if (p.side === "buy") {
      if (filledQty>0 && premium>0) {
        const row:Rec = {
          id:p.trade_id,user_id:userId,side:p.signal.side,option_symbol:p.contract.symbol,strike:p.contract.strike,expiry:p.contract.expiry,
          window:p.signal.window,contracts:filledQty,entry_time:order.filled_at ?? now.toISOString(),entry_premium:premium,entry_underlying:p.signal.price,
          peak_premium:premium,peak_gain_pct:0,final_floor_pct:null,cycle:state.cycles,alpaca_entry_order_id:order.id,status:"open",
        };
        state.open_trade = {side:p.signal.side,optionSymbol:p.contract.symbol,strike:p.contract.strike,contracts:filledQty,entryPremium:premium,peakPremium:premium,floorPct:null,
          entryCloseTime:new Date(Date.parse(p.signal.barTime)+cfg.timeframeMin*60000).toISOString(),windowExitAt:iwmWindowExitAt(p.signal.barTime,cfg,p.signal.window),connectionId:p.connection_id,tradeRow:row,exitFilledQty:0,exitValue:0};
        state.trades_today++;
        event("trades",row); note("ENTRY",`IWM $${p.contract.strike} ${p.signal.side} • ${filledQty} contracts @ $${premium.toFixed(2)}`);
      }
      const {error} = await db.from("iwm_signals").update({action:filledQty>0 ? "filled":"unfilled"}).eq("id",p.signal_id).eq("user_id",userId);
      if (error) throw new Error("Could not reconcile the entry alert");
      state.pending_order=null; await checkpoint(); return;
    }
    const t = state.open_trade;
    if (!t) throw new Error("Sell order has no matching strategy position; manual review needed");
    t.exitFilledQty = Number(t.exitFilledQty ?? 0)+filledQty;
    t.exitValue = Number(t.exitValue ?? 0)+filledQty*premium;
    if (t.exitFilledQty >= t.contracts) {
      await finishTrade(t.exitValue/t.contracts,p.reason,order.id,order.filled_at ?? now.toISOString(),p.underlying ?? t.liveUnderlying ?? null);
    } else if (p.partial && t.exitFilledQty>=p.targetFilledQty) {
      t.partialTaken=true;
      t.exitRequested=null;
      state.pending_order=null;
      note('PARTIAL PROFIT',`IWM ${t.side} • ${t.exitFilledQty}/${t.contracts} contracts sold • +35% target`);
      await checkpoint();
    } else {
      // Account for a terminal partially-filled sell before placing only the remainder.
      const remaining=(p.partial ? p.targetFilledQty : t.contracts)-t.exitFilledQty;
      state.pending_order=null; await checkpoint();
      const replacementId=`iwm-${crypto.randomUUID()}`;
      await submitIntent({...p,id:undefined,client_id:replacementId,submitted_at:now.toISOString(),body:{...p.body,client_order_id:replacementId,qty:String(remaining),type:"market",limit_price:undefined}});
    }
  }
  async function requestExit(reason:string,bid?:number,qty?:number,partial=false) {
    const t = state.open_trade;
    if (!t || state.pending_order) return;
    if (!partial) t.exitRequested=reason;
    const clientId=`iwm-${crypto.randomUUID()}`;
    const sellQty=Math.min(qty ?? t.contracts-Number(t.exitFilledQty ?? 0),t.contracts-Number(t.exitFilledQty ?? 0));
    if (!(sellQty>0)) return;
    const body:Rec={symbol:t.optionSymbol,qty:String(sellQty),side:"sell",type:bid && bid>0 ? "limit":"market",time_in_force:"day",position_intent:"sell_to_close",client_order_id:clientId};
    if (body.type === "limit") body.limit_price=money(Number(bid)).toFixed(2);
    await submitIntent({side:"sell",client_id:clientId,submitted_at:now.toISOString(),reason,underlying:t.liveUnderlying,body,connection_id:t.connectionId,partial,targetFilledQty:Number(t.exitFilledQty ?? 0)+sellQty});
  }
  /** Sweep half of a profitable day into fractional WMT. Write-before-submit; errors never interrupt option handling. */
  async function savingsSweep(date:string,canSubmit:boolean) {
    try {
      const s=state.savings_intent;
      if (s) {
        let order=await api.findOrder(s.client_id);
        if (!order) {
          if (!(canSubmit && s.day===date)) { event("savings",{day:s.day,amount:s.amount,status:"not submitted"}); state.savings_intent=null; await checkpoint(); return; }
          order=await api.submit(s.body);
        }
        if (!terminalOrder(order.status)) return;
        const qty=Number(order.filled_qty||0), price=Number(order.filled_avg_price||0);
        state.savings_total=money(Number(state.savings_total ?? 0)+qty*price);
        event("savings",{day:s.day,amount:s.amount,filled_qty:qty,filled_avg_price:price||null,status:order.status,alpaca_order_id:order.id});
        state.savings_intent=null; await checkpoint();
        if (qty>0) note("SAVINGS",`$${(qty*price).toFixed(2)} saved in ${IWM_SAVINGS_SYMBOL} • ${qty.toFixed(4)} shares`);
        return;
      }
      if (!canSubmit || state.savings_day===date || state.trading_day!==date) return;
      const amount=savingsAmount(Number(state.pnl_today));
      state.savings_day=date;
      if (!amount) { await checkpoint(); return; }
      const clientId=`iwm-save-${crypto.randomUUID()}`;
      const body={symbol:IWM_SAVINGS_SYMBOL,notional:amount.toFixed(2),side:"buy",type:"market",time_in_force:"day",client_order_id:clientId};
      state.savings_intent={client_id:clientId,day:date,amount,body};
      event("savings",{day:date,amount,status:"submitting"});
      await checkpoint();
      const order=(await api.findOrder(clientId)) ?? await api.submit(body);
      event("savings",{day:date,amount,status:order.status ?? "submitted",alpaca_order_id:order.id});
      await checkpoint();
    } catch(e) {
      const message=e instanceof Error ? e.message : "WMT savings sweep failed";
      logError("savings",message);
    }
  }
  async function dailyReport(date:string,minutes:number) {
    if (minutes<965 || state.reported_day===date || state.trading_day!==date || !state.last_bar_time || etParts(state.last_bar_time).date!==date || state.open_trade || state.pending_order) return;
    event("reports",{id:crypto.randomUUID(),day:date,trades:state.trades_today,wins:state.wins_today,losses:state.losses_today,
      win_rate:state.trades_today ? state.wins_today/state.trades_today:0,pnl:state.pnl_today,banked_today:state.banked_today,banked_total:state.banked_total,ending_bankroll:state.balance});
    state.reported_day=date; await checkpoint();
    note("DAILY REPORT",`${date} • ${state.trades_today} trades • ${state.wins_today}W/${state.losses_today}L • P&L $${Number(state.pnl_today).toFixed(2)} • bankroll $${Number(state.balance).toFixed(2)}`);
  }
  try {
    api=apiOverride ?? await iwmAlpaca(db,userId,state.pending_order?.connection_id ?? state.open_trade?.connectionId);
    const clock=await api.clock(); now=new Date(clock.timestamp);
    if (!Number.isFinite(now.getTime())) throw new Error("Alpaca clock returned an invalid time");
    const {date,minutes}=etParts(now.toISOString());
    if (state.trading_day !== date) {
      // Do not discard a position or unconfirmed order across midnight.
      Object.assign(state,{trading_day:date,trades_today:0,pnl_today:0,wins_today:0,losses_today:0,banked_today:0,alerted_keys:[]});
      if (state.open_trade) state.open_trade.exitRequested="Overnight recovery: close at first available market";
    }
    if (state.balance == null) state.balance=cfg.startingBankroll;
    state.last_run_at=now.toISOString();state.last_error=null;
    await checkpoint();
    await reconcile();deadline();
    await reconcileBroker();deadline();
    if (!clock.is_open) {
      await savingsSweep(date,false);
      await dailyReport(date,minutes);
      if (state.open_trade) { state.last_error="Market is closed with an unresolved position; exit will be retried when open"; await checkpoint(); }
      ok=true;
      return {status:"market closed",paper:true};
    }
    // Calendar-driven: force exit 10 minutes before the real close; no entries in the last hour of an early close.
    const closeMinutes=etParts(clock.next_close).minutes;
    const sessionEnd=sessionEndMinutes(closeMinutes);
    state.session_close=clock.next_close;
    const forced=minutes>=Math.min(forceExitMinutes(settings.force_exit_time),closeMinutes-10) || !!settings.kill_switch;
    const pastForceExit=minutes>=Math.min(forceExitMinutes(settings.force_exit_time),closeMinutes-10);
    await savingsSweep(date,pastForceExit && !settings.kill_switch && !state.open_trade && !state.pending_order);
    if (state.open_trade) {
      if (forced) state.open_trade.exitRequested=settings.kill_switch ? "Kill switch":"Force exit before market close";
      const windowDeadline = state.open_trade.windowExitAt ?? iwmWindowExitAt(state.open_trade.tradeRow?.entry_time, cfg, state.open_trade.tradeRow?.window);
      const windowExit = windowDeadline !== null && now.getTime() >= windowDeadline;
      if (!forced && windowExit) state.open_trade.exitRequested='20-minute window closing';
      let quote:any;
      try { quote=await api.quote(state.open_trade.optionSymbol,settings.options_feed); }
      catch { state.last_error="Option quote unavailable; position monitoring will retry"; }
      const valid=freshQuote(quote,now);
      if (valid) {
        const t=state.open_trade, premium=Number(quote.bp);
        t.livePremium=premium;t.quoteTime=quote.t;
        t.peakPremium=Math.max(t.peakPremium,premium); t.floorPct=null;
        const action=profitAction(t,premium);
        if (action && !t.exitRequested && !state.pending_order) {
          if (action.partial) await requestExit(action.reason,premium,action.qty,true);
          else t.exitRequested=action.reason;
        }
        await checkpoint();
      }
      if (state.open_trade.exitRequested) await requestExit(state.open_trade.exitRequested,windowExit ? undefined : valid ? Number(quote.bp):undefined);
    }
    deadline();
    const bars=closedRegularBars(await api.bars(cfg,settings.data_feed,now),now,cfg);
    const last=bars[bars.length-1];
    if (!last || etParts(last.t).date!==date) { await checkpoint();return {status:"waiting for today's closed bars",paper:true}; }
    if (!state.last_bar_time || Date.parse(last.t)>Date.parse(state.last_bar_time)) {
      const rows=addIndicators(bars,cfg), ind=rows[rows.length-1];
      state.last_bar_time=last.t;
      if (state.open_trade) {
        state.open_trade.liveUnderlying=last.c;
        const t=state.open_trade;
        if (freshQuote({bp:t.livePremium,ap:t.livePremium,t:t.quoteTime},now) && profitableReversal(t,ind,t.livePremium)) {
          t.exitRequested='Profitable first reversal candle'; await checkpoint(); await requestExit(t.exitRequested,t.livePremium);
        } else if (!t.exitRequested && emaCloseBreak(t,ind)) {
          t.exitRequested=`8 EMA close break (close ${ind.c.toFixed(2)} vs ${ind.emaFast.toFixed(2)})`; await checkpoint(); await requestExit(t.exitRequested);
        }
      } else if (!state.pending_order && settings.enabled && !forced && now.getTime()-Date.parse(last.t)<=cfg.timeframeMin*60000+90000) {
        const keys=new Set<string>(state.alerted_keys ?? []);
        const signals=crossEntry(ind,keys,cfg);
        state.alerted_keys=[...keys];
        for (const signal of signals) {
          const id=crypto.randomUUID();
          event("signals",{id,user_id:userId,created_at:now.toISOString(),bar_time:signal.barTime,window:signal.window,kind:signal.kind,side:signal.side,price:signal.price,
            ema8:ind.emaFast,ema20:ind.emaSlow,osc:Number.isFinite(ind.osc) ? ind.osc:null,detail:signal.detail,action:signal.kind==="potential" ? "alert":"evaluating"});
          await checkpoint();
          if (signal.kind==="potential") { note("POTENTIAL ENTRY",`IWM $${signal.price.toFixed(2)} ${signal.side} • Window ${signal.window}/15`); continue; }
          const windowDeadline = iwmWindowExitAt(signal.barTime,cfg,signal.window);
          const block=entryBlock(settings,state) ?? (minutes>=sessionEnd ? "early close":null) ?? (windowDeadline !== null && now.getTime()>=windowDeadline ? 'window closing':null);
          let action=block ?? "daily limit";
          if (!block && state.trades_today<settings.max_trades_per_day) {
            deadline();
            const contract=await api.chooseContract(signal.side,signal.price,date,settings.options_feed,now,'IWM',true);
            action="no valid option quote";
            if (contract) {
              const bank={balance:Number(state.balance),bankedTotal:Number(state.banked_total),cycles:Number(state.cycles)};
              let qty=contractsFor(bank,contract.ask,cfg);
              if (qty<1) {state.balance=cfg.startingBankroll;bank.balance=cfg.startingBankroll;qty=contractsFor(bank,contract.ask,cfg);state.last_error="Bankroll restarted because no contract was affordable";await checkpoint();}
              action="insufficient bankroll";
              if (qty>=1) {
                const clientId=`iwm-${crypto.randomUUID()}`;
                await submitIntent({side:"buy",client_id:clientId,submitted_at:now.toISOString(),signal,signal_id:id,contract,trade_id:crypto.randomUUID(),connection_id:api.connectionId,
                  body:{symbol:contract.symbol,qty:String(qty),side:"buy",type:"limit",limit_price:money(contract.ask).toFixed(2),time_in_force:"day",position_intent:"buy_to_open",client_order_id:clientId}});
                action="submitted";
              }
            }
          }
          const {error}=await db.from("iwm_signals").update({action}).eq("user_id",userId).eq("id",id);
          if (error) throw new Error("Could not update entry outcome");
        }
      }
      await checkpoint();
    }
    await dailyReport(date,minutes);
    ok=true;
    return {status:state.pending_order ? "order pending":state.open_trade ? "in trade":"scanning",paper:true};
  } catch(error) {
    const message=error instanceof Error ? error.message:"IWM run failed";
    runError=message;
    console.error("IWM run:",message);
    logError("run",message);
    // Never write uncommitted bookkeeping after a failed checkpoint; retained intent enables safe recovery.
    await db.from("iwm_strategy_state").update({last_error:message,last_run_at:new Date().toISOString()}).eq("user_id",userId).eq("lock_token",token);
    return {status:"error",error:message,paper:true};
  } finally {
    const finished=new Date().toISOString();
    await db.from("iwm_strategy_state").update({lock_until:null,lock_token:null,...(ok ? {last_success_at:finished}:{}),...(state.session_close ? {session_close:state.session_close}:{})}).eq("user_id",userId).eq("lock_token",token);
    // Monitoring writes must never break trading; failures here are logged only.
    try {
      const r=await db.from("bot_runs").insert({user_id:userId,started_at:new Date(started).toISOString(),finished_at:finished,ok,error:runError,duration_ms:Date.now()-started});
      if (r?.error) console.error("IWM bot_runs write failed");
      if (errorRows.length) { const e=await db.from("bot_errors").insert(errorRows); if (e?.error) console.error("IWM bot_errors write failed"); }
    } catch { console.error("IWM monitoring write failed"); }
    for (const n of notifications) await iwmDiscord(settings.discord_enabled,n.type,n.body);
  }
}

export async function runIwmScheduled() {
  const {supabaseAdmin} = await import("@/integrations/supabase/client.server");
  const {data:settings,error}=await supabaseAdmin.from("iwm_strategy_settings").select("*");
  if (error) throw new Error("Could not read IWM strategy settings");
  const {data:active,error:activeError}=await supabaseAdmin.from("iwm_strategy_state").select("user_id").or("open_trade.not.is.null,pending_order.not.is.null");
  if (activeError) throw new Error("Could not read active IWM positions");
  const activeUsers=new Set((active ?? []).map(s=>s.user_id));
  const users=(settings ?? []).filter(s=>s.enabled || activeUsers.has(s.user_id));
  let errors=0;
  for (const s of users) { const result=await runIwmUser(supabaseAdmin,s);if(result.status==="error") errors++; }
  return {users:users.length,errors};
}