// Automatic scanner: picks strategies pre-market and checks the watchlist for live setups.
import { decryptJson, dataAdapter } from "@/lib/server/providers.server";
import { parseStrategyId } from "@/lib/strategy-names";
import { nyDate } from "@/lib/market-hours";

type Rec = Record<string, any>;
type Bar = { t: string; o: number; h: number; l: number; c: number; v: number };
export type ScanPhase = "premarket" | "open" | "afternoon";

/** Maps the New York hour to a scan phase; null means "not a scan hour". */
export function phaseForNyHour(hour: number): ScanPhase | null {
  if (hour === 9) return "premarket";
  if (hour === 10) return "open";
  if (hour === 14) return "afternoon";
  return null;
}

export function nyHour(d = new Date()) {
  return Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "2-digit", hour12: false }).format(d)) % 24;
}

async function chooseTodayPicks(db: any, userId: string, settings: Rec, runId: string, today: string) {
  const { data: existing } = await db.from("picks").select("strategy_id").eq("user_id", userId).eq("trade_date", today);
  if (existing?.length) return existing.map((p: Rec) => p.strategy_id as string);
  const r: Rec = (await import("@/data/backtest_report.json")).default;
  const all: Rec[] = r.most_selected ?? [];
  let chosen = all.filter(
    (s) =>
      s.profit_factor >= Number(settings.min_profit_factor) &&
      s.win_rate >= Number(settings.min_win_rate) &&
      s.trades >= Number(settings.min_trades),
  );
  if (!chosen.length) chosen = [...all].sort((a, b) => b.profit_factor - a.profit_factor);
  chosen = chosen.slice(0, 10);
  if (chosen.length)
    await db.from("picks").insert(
      chosen.map((s) => ({
        user_id: userId,
        run_id: runId,
        strategy_id: s.strategy,
        trade_date: today,
        bt_trades: s.trades,
        bt_win_rate: s.win_rate,
        bt_profit_factor: s.profit_factor,
        bt_avg_r: s.avg_R,
      })),
    );
  return chosen.map((s) => s.strategy as string);
}

function atr(days: Bar[], n = 14) {
  const tr = days.slice(1).map((b, i) => Math.max(b.h - b.l, Math.abs(b.h - days[i].c), Math.abs(b.l - days[i].c)));
  const last = tr.slice(-n);
  return last.length ? last.reduce((a, b) => a + b, 0) / last.length : 0;
}

/** Returns true when the strategy's setup is currently triggered. Exported for tests. */
export function triggered(family: string, p: number[], side: "long" | "short", bars: Bar[], prev: Bar, a: number): boolean {
  if (!bars.length || a <= 0) return false;
  const last = bars[bars.length - 1];
  const dir = side === "long" ? 1 : -1;
  const open = bars[0].o;
  switch (family) {
    case "orb": {
      const n = p[0] ?? 6;
      if (bars.length <= n) return false;
      const rng = bars.slice(0, n);
      return side === "long" ? last.c > Math.max(...rng.map((b) => b.h)) : last.c < Math.min(...rng.map((b) => b.l));
    }
    case "gap_and_go":
      return (dir * (open - prev.c)) / a > (p[0] ?? 0.5) && dir * (last.c - open) > 0;
    case "gap_fade":
      return (-dir * (open - prev.c)) / a > (p[0] ?? 0.5) && dir * (last.c - open) > 0;
    case "prior_day_break":
      return side === "long" ? last.c > prev.h : last.c < prev.l;
    case "vwap_reclaim": {
      let pv = 0, vv = 0;
      for (const b of bars) { pv += ((b.h + b.l + b.c) / 3) * b.v; vv += b.v; }
      const vwap = vv ? pv / vv : last.c;
      const extreme = side === "long" ? Math.min(...bars.map((b) => b.l)) : Math.max(...bars.map((b) => b.h));
      return dir * (vwap - extreme) / a > (p[0] ?? 0.5) && dir * (last.c - vwap) > 0;
    }
    case "momentum_at":
      return (dir * (last.c - open)) / a > (p[1] ?? 0.5);
    case "reversion_at":
      return (-dir * (last.c - open)) / a > (p[1] ?? 0.5);
    default:
      return false;
  }
}

async function scanUser(db: any, userId: string, phase: ScanPhase) {
  const today = nyDate();
  const { data: settings } = await db.from("settings").select("*").eq("user_id", userId).maybeSingle();
  const { data: conns } = await db.from("connections").select("*").eq("user_id", userId).eq("is_default_data", true).limit(1);
  const conn = conns?.[0];
  if (!settings || !conn) return { skipped: "no data connection" };
  const { data: run } = await db
    .from("engine_runs")
    .insert({ user_id: userId, kind: "scan", status: "running", rule: { phase } })
    .select("id")
    .single();
  try {
    const pickIds = await chooseTodayPicks(db, userId, settings, run.id, today);
    let created = 0;
    if (phase !== "premarket") {
      const sec = await decryptJson(conn.secret_cipher, conn.secret_iv);
      const data = dataAdapter({ provider: conn.provider, environment: conn.environment, config: conn.config }, sec);
      const strategies = pickIds.map((id: string) => ({ id, p: parseStrategyId(id) })).filter((s: Rec) => s.p);
      const { data: already } = await db.from("signals").select("strategy_id,symbol").eq("user_id", userId).eq("trade_date", today);
      const seen = new Set((already ?? []).map((s: Rec) => `${s.strategy_id}|${s.symbol}`));
      const now = new Date();
      const start30 = new Date(now.getTime() - 45 * 86400000).toISOString();
      const dayStart = new Date(`${today}T13:00:00Z`).toISOString();
      for (const symbol of (settings.watchlist ?? []).slice(0, 30)) {
        try {
          const daily: Bar[] = await data.getBars(symbol, "1Day", start30, now.toISOString());
          const intraday: Bar[] = (await data.getBars(symbol, "5Min", dayStart, now.toISOString())).filter(
            (b: Bar) => nyDate(new Date(b.t)) === today,
          );
          const past = daily.filter((b) => nyDate(new Date(b.t)) < today);
          const prev = past[past.length - 1];
          if (!prev || !intraday.length) continue;
          const a = atr(past);
          const entry = intraday[intraday.length - 1].c;
          const rows: Rec[] = [];
          for (const s of strategies) {
            const key = `${s.id}|${symbol}`;
            if (seen.has(key) || !triggered(s.p.family, s.p.params, s.p.side, intraday, prev, a)) continue;
            seen.add(key);
            const risk = s.p.stop * a;
            const dir = s.p.side === "long" ? 1 : -1;
            rows.push({
              user_id: userId,
              strategy_id: s.id,
              symbol,
              side: s.p.side,
              entry: +entry.toFixed(2),
              stop: +(entry - dir * risk).toFixed(2),
              target: s.p.target == null ? null : +(entry + dir * risk * s.p.target).toFixed(2),
              signal_time: now.toISOString(),
              trade_date: today,
            });
          }
          if (rows.length) {
            await db.from("signals").insert(rows);
            created += rows.length;
          }
        } catch (e) {
          console.error(`scan ${symbol}:`, e instanceof Error ? e.message : e);
        }
      }
    }
    const summary = { phase, picks: pickIds.length, signals: created };
    await db.from("engine_runs").update({ status: "ok", finished_at: new Date().toISOString(), summary }).eq("id", run.id);
    return summary;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await db.from("engine_runs").update({ status: "failed", finished_at: new Date().toISOString(), error: msg }).eq("id", run.id);
    return { error: msg };
  }
}

export async function runScheduledScan(phase: ScanPhase) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: users } = await supabaseAdmin.from("connections").select("user_id").eq("is_default_data", true);
  const ids = [...new Set((users ?? []).map((u) => u.user_id))];
  const results: Rec = {};
  for (const id of ids) results[id] = await scanUser(supabaseAdmin, id, phase);
  return { phase, users: ids.length, results };
}
