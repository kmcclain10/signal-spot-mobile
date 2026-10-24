import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getProviderDef } from "@/lib/providers";
import { nyDate } from "@/lib/market-hours";
import { positionSize } from "@/lib/format";
import { assertNoPulseOwnership, isBotOrder } from "@/lib/bot-ownership";

type Rec = Record<string, any>;

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function loadConn(userId: string, id: string) {
  const db = await admin();
  const { data, error } = await db.from("connections").select("*").eq("id", id).eq("user_id", userId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Connection not found");
  return data;
}

async function runTest(userId: string, id: string) {
  const { decryptJson, testProvider } = await import("@/lib/server/providers.server");
  const db = await admin();
  const c = await loadConn(userId, id);
  let ok = false;
  let message: string;
  try {
    const sec = await decryptJson(c.secret_cipher, c.secret_iv);
    message = await testProvider(c.provider, c.config as Rec, sec, c.environment);
    ok = true;
  } catch (e) {
    message = e instanceof Error ? e.message : String(e);
  }
  await db
    .from("connections")
    .update({ status: ok ? "ok" : "failed", status_detail: message, last_tested_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", userId);
  return { ok, message };
}

export const saveConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (i: { id?: string; provider: string; label: string; environment: string; config: Rec; secrets: Record<string, string> }) => i,
  )
  .handler(async ({ data, context }) => {
    const { encryptJson, decryptJson } = await import("@/lib/server/providers.server");
    const def = getProviderDef(data.provider);
    const db = await admin();
    const config: Rec = {};
    const secrets: Record<string, string> = {};
    for (const f of def.fields) {
      if (f.secret) {
        const v = (data.secrets?.[f.key] ?? "").trim();
        if (v) secrets[f.key] = v;
      } else {
        const v = data.config?.[f.key];
        if (v !== undefined && v !== "") config[f.key] = String(v).slice(0, 2000);
      }
    }
    if (config.base_url) {
      try {
        const u = new URL(config.base_url);
        if (u.protocol !== "https:" && u.protocol !== "http:") throw new Error();
      } catch {
        throw new Error("Base URL must be a valid http(s) URL");
      }
    }
    let existing: Rec | null = null;
    if (data.id) existing = await loadConn(context.userId, data.id);
    // merge: blank secret fields keep their old values
    const merged = existing ? { ...(await decryptJson(existing.secret_cipher, existing.secret_iv)), ...secrets } : secrets;
    for (const f of def.fields) {
      if (f.required && !(f.secret ? merged[f.key] : config[f.key])) throw new Error(`${f.label} is required`);
    }
    const firstSecret = def.fields.find((f) => f.secret && merged[f.key]);
    const enc = Object.keys(merged).length ? await encryptJson(merged) : { cipher: null, iv: null };
    const row = {
      user_id: context.userId,
      provider: def.id,
      label: (data.label || def.name).slice(0, 80),
      environment: def.hasEnvironment ? (data.environment === "live" ? "live" : "paper") : "n/a",
      config,
      secret_cipher: enc.cipher,
      secret_iv: enc.iv,
      secret_hint: firstSecret ? String(merged[firstSecret.key]).slice(-4) : null,
      status: "untested",
      status_detail: null,
      updated_at: new Date().toISOString(),
    };
    let id = data.id;
    if (id) {
      const { error } = await db.from("connections").update(row).eq("id", id).eq("user_id", context.userId);
      if (error) throw new Error(error.message);
    } else {
      // first connection of a capability becomes the default
      const { data: others } = await db
        .from("connections")
        .select("is_default_data,is_default_broker")
        .eq("user_id", context.userId);
      const hasData = (others ?? []).some((o) => o.is_default_data);
      const hasBroker = (others ?? []).some((o) => o.is_default_broker);
      const { data: ins, error } = await db
        .from("connections")
        .insert({
          ...row,
          is_default_data: !hasData && def.capabilities.includes("data"),
          is_default_broker: !hasBroker && def.capabilities.includes("broker"),
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      id = ins.id;
    }
    const t = await runTest(context.userId, id!);
    return { id: id!, status: t.ok ? "ok" : "failed", message: t.message };
  });

export const testConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => i)
  .handler(async ({ data, context }) => runTest(context.userId, data.id));

export const setDefaultConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string; kind: "data" | "broker" }) => i)
  .handler(async ({ data, context }) => {
    const db = await admin();
    const c = await loadConn(context.userId, data.id);
    if (!getProviderDef(c.provider).capabilities.includes(data.kind)) throw new Error(`This provider can't be a ${data.kind} default`);
    const col = data.kind === "data" ? "is_default_data" : "is_default_broker";
    const off = (data.kind === "data" ? { is_default_data: false } : { is_default_broker: false }) as any;
    const on = (data.kind === "data" ? { is_default_data: true } : { is_default_broker: true }) as any;
    void col;
    await db.from("connections").update(off).eq("user_id", context.userId);
    const { error } = await db.from("connections").update(on).eq("id", data.id).eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

async function pickConnection(userId: string, capability: string, connectionId?: string) {
  const db = await admin();
  if (connectionId) return loadConn(userId, connectionId);
  let q = db.from("connections").select("*").eq("user_id", userId);
  if (capability === "data") q = q.eq("is_default_data", true);
  else if (capability === "broker") q = q.eq("is_default_broker", true);
  else q = q.eq("provider", capability === "news" ? "finnhub" : "custom");
  const { data } = await q.order("created_at").limit(1);
  const c = data?.[0];
  if (!c) throw new Error(`No ${capability} connection set up yet — add one on the Connections page`);
  return c;
}

const ALLOWED: Record<string, string[]> = {
  data: ["getBars", "getLastPrice"],
  broker: ["getAccount", "getPositions", "getOrders", "cancelOrder", "closePosition"],
  news: ["getNews"],
  custom: ["request"],
};

export const providerProxy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { connection_id?: string; capability: string; action: string; args?: any[] }) => i)
  .handler(async ({ data, context }) => {
    if (!ALLOWED[data.capability]?.includes(data.action)) throw new Error("Action not allowed");
    const p = await import("@/lib/server/providers.server");
    const c = await pickConnection(context.userId, data.capability, data.connection_id);
    const sec = await p.decryptJson(c.secret_cipher, c.secret_iv);
    const conn = { provider: c.provider, environment: c.environment, config: c.config as Rec };
    const args = data.args ?? [];
    if(data.capability==="broker" && (data.action==="cancelOrder"||data.action==="closePosition")){
      if(c.provider!=="alpaca"||c.environment!=="paper") throw new Error("Use the paper Trade desk for protected position actions");
      const {iwmAlpaca}=await import("@/lib/server/iwm-alpaca.server");
      const api=await iwmAlpaca(await admin(),context.userId,c.id);
      if(data.action==="cancelOrder"){
        const order=await api.order(String(args[0]));if(isBotOrder(order.client_order_id)) throw new Error("Bot orders must be stopped from Bots");
      }else{
        await assertNoPulseOwnership(context.supabase,context.userId,String(args[0]));
        const st=await context.supabase.from("iwm_strategy_state").select("open_trade").eq("user_id",context.userId).maybeSingle();
        if(st.error) throw new Error("Could not verify bot ownership");
        if((st.data?.open_trade as Rec|null)?.optionSymbol===args[0]) throw new Error("Close the IWM bot position from the Trade desk");
      }
    }
    let result: unknown;
    if (data.capability === "broker") result = await (p.brokerAdapter(conn, sec) as any)[data.action](...args);
    else if (data.capability === "data") result = await (p.dataAdapter(conn, sec) as any)[data.action](...args);
    else if (data.capability === "news") result = await (p.newsAdapter(conn, sec) as any)[data.action](...args);
    else result = await p.customRequest(conn.config, sec, args[0] ?? {});
    return JSON.parse(JSON.stringify({ result, environment: c.environment, connection: c.label })) as {
      result: any;
      environment: string;
      connection: string;
    };
  });

export const placeSignalOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { signal_id: string }) => i)
  .handler(async ({ data, context }) => {
    const p = await import("@/lib/server/providers.server");
    const db = await admin();
    const uid = context.userId;
    const { data: sig } = await db.from("signals").select("*").eq("id", data.signal_id).eq("user_id", uid).maybeSingle();
    if (!sig) throw new Error("Signal not found");
    await assertNoPulseOwnership(context.supabase,uid,sig.symbol);
    if (sig.trade_date !== nyDate()) throw new Error("Only today's signals can be traded");
    if (sig.status !== "new") throw new Error(`Signal is already ${sig.status}`);
    const { data: settings } = await db.from("settings").select("*").eq("user_id", uid).maybeSingle();
    if (!settings) throw new Error("Settings not found");
    const c = await pickConnection(uid, "broker");
    if (c.environment === "live" && settings.trading_mode !== "live")
      throw new Error("Your default broker is LIVE but trading mode is Paper. Switch mode in Settings first.");
    const sec = await p.decryptJson(c.secret_cipher, c.secret_iv);
    const broker = p.brokerAdapter({ provider: c.provider, environment: c.environment, config: c.config as Rec }, sec);
    const [acct, positions] = await Promise.all([broker.getAccount(), broker.getPositions()]);
    if (positions.length >= settings.max_open_positions)
      throw new Error(`Max open positions reached (${settings.max_open_positions})`);
    if (acct.dayPl <= -Number(settings.max_daily_loss_usd))
      throw new Error(`Max daily loss hit (${acct.dayPl.toFixed(2)}) — no new orders today`);
    const entry = Number(sig.entry);
    const stop = Number(sig.stop);
    const target = sig.target == null ? null : Number(sig.target);
    const qty = positionSize(Number(settings.risk_per_trade_usd), entry, stop);
    const side = sig.side === "long" ? "buy" : "sell";
    const placed = await broker.placeBracketOrder({ symbol: sig.symbol, side, qty, stop, target, clientId: sig.id });
    const { data: order } = await db
      .from("orders")
      .insert({
        user_id: uid,
        signal_id: sig.id,
        connection_id: c.id,
        environment: c.environment,
        broker_order_id: placed.id,
        symbol: sig.symbol,
        side,
        qty,
        entry,
        stop,
        target,
        status: placed.status ?? "submitted",
        raw: placed.raw,
      })
      .select("id")
      .single();
    await db.from("signals").update({ status: "ordered" }).eq("id", sig.id);
    return { order_id: order?.id ?? null, broker_order_id: placed.id, qty, side, environment: c.environment };
  });

/** Loads the backtest report bundled with the engine as an engine run for the current user. */
export const importBundledBacktest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const r: Rec = (await import("@/data/backtest_report.json")).default;
    const db = await admin();
    const { data, error } = await db
      .from("engine_runs")
      .insert({
        user_id: context.userId,
        kind: "backtest",
        status: "ok",
        started_at: new Date(r.period[0]).toISOString(),
        finished_at: new Date().toISOString(),
        rule: r.rule,
        summary: {
          oos: r.oos_selected,
          in_sample: r.in_sample_of_picks,
          baseline: r.baseline_all_strategies,
          random: r.baseline_random_picks_same_count,
          max_drawdown_R: r.max_drawdown_R,
          period: r.period,
          avg_strategies_selected_per_day: r.avg_strategies_selected_per_day,
        },
        by_year: r.oos_by_year,
        equity: r.equity,
        most_selected: r.most_selected,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: data.id };
  });
