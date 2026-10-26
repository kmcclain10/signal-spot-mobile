import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Bot, ShieldCheck, Library, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getBotsOverview } from "@/lib/bots.functions";
import { saveIwmSettings, acknowledgeIwmReview } from "@/lib/iwm.functions";
import { allocationSummary, botHealth, runStats } from "@/lib/bots-rules";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { useAccountConfirmation } from "@/components/AccountSecurity";
import { sensitiveIwmChange } from "@/lib/account-rules";
import { SeparateBots, separateBotsOptions } from "@/components/SeparateBots";

const options = queryOptions({ queryKey: ["bots-overview"], queryFn: () => getBotsOverview(), refetchInterval: 30000 });
export const Route = createFileRoute("/_authenticated/bots")({
  head: () => ({
    meta: [
      { title: "Bots — Pulse Signals" },
      { name: "description", content: "Control your paper trading bots: allocation, health, run history and safety switches." },
      { property: "og:title", content: "Bots — Pulse Signals" },
      { property: "og:description", content: "Paper bot allocation, controls and run health." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: async ({ context }) => { await Promise.all([context.queryClient.ensureQueryData(options),context.queryClient.ensureQueryData(separateBotsOptions)]); },
  component: BotsPage,
});

const cash = (v: unknown) => Number(v ?? 0).toLocaleString("en-US", { style: "currency", currency: "USD" });
const time = (v: string) => new Date(v).toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) + " ET";
const HEALTH_TONE: Record<string, string> = { running: "text-gain", paused: "text-warning", offline: "text-destructive", disabled: "text-muted-foreground" };

function BotsPage() {
  const confirmation = useAccountConfirmation();
  const { data } = useSuspenseQuery(options);
  const qc = useQueryClient();
  const user = Route.useRouteContext().user;
  const save = useServerFn(saveIwmSettings);
  const acknowledge = useServerFn(acknowledgeIwmReview);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(new Date());
  const settings = data.settings ?? { enabled: false, kill_switch: false, max_daily_loss: 100, starting_bankroll: 200, bank_trigger: 25200 };
  const [lossDraft, setLossDraft] = useState(String(settings.max_daily_loss ?? 100));
  useEffect(() => { setLossDraft(String(settings.max_daily_loss ?? 100)); }, [settings.max_daily_loss]);
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 10000); return () => clearInterval(t); }, []);
  useEffect(() => {
    const ch = supabase.channel(`bots-${user.id}`);
    for (const table of ["iwm_strategy_state", "bot_runs"]) ch.on("postgres_changes", { event: "*", schema: "public", table, filter: `user_id=eq.${user.id}` }, () => { qc.invalidateQueries({ queryKey: options.queryKey }); });
    ch.subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user.id, qc]);

  async function persist(values: Record<string, unknown>) {
    if (sensitiveIwmChange(settings, values) && !await confirmation()) return;
    setBusy(true);
    try { await save({ data: values }); await qc.invalidateQueries({ queryKey: options.queryKey }); toast.success("Bot settings saved"); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Could not save settings"); }
    finally { setBusy(false); }
  }

  const health = botHealth(now, settings, data.state);
  const alloc = allocationSummary(settings, data.state);
  const stats = runStats(data.runs);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Bots</h1>
        <p className="mt-1 text-sm text-muted-foreground">Your automated paper traders. Every bot here trades paper money only.</p>
      </header>

      <section className="space-y-5 rounded-lg border bg-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 rounded-md bg-primary/15 p-2 text-primary"><Bot className="size-5" /></span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-semibold">IWM 20-Min Window</h2>
                <span className="flex items-center gap-1 text-xs font-semibold text-gain"><ShieldCheck className="size-3.5" />PAPER ONLY</span>
              </div>
              <p className={cn("mt-1 text-sm font-medium", HEALTH_TONE[health.status])}>{health.detail}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="bot-enabled">Enabled</Label>
            <Switch id="bot-enabled" checked={!!settings.enabled} disabled={busy} onCheckedChange={(enabled) => persist({ enabled })} />
          </div>
        </div>

        {data.state?.needs_review && (
          <div className="space-y-2 border-l-2 border-destructive bg-destructive/10 p-3 text-sm text-destructive">
            <p><strong>New trades paused:</strong> {data.state.needs_review}. Check your Alpaca positions, then confirm.</p>
            <Button size="sm" variant="outline" disabled={busy} onClick={async () => { setBusy(true); try { await acknowledge(); await qc.invalidateQueries({ queryKey: options.queryKey }); toast.success("Bot may trade again"); } finally { setBusy(false); } }}>I've checked — resume trading</Button>
          </div>
        )}

        <div>
          <h3 className="mb-3 text-sm font-medium">Allocation</h3>
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div><p className="text-xs text-muted-foreground">Bankroll</p><p className="num mt-1 font-semibold">{cash(alloc.allocated)}</p></div>
            <div><p className="text-xs text-muted-foreground">Balance</p><p className="num mt-1 font-semibold">{cash(alloc.balance)}</p></div>
            <div><p className="text-xs text-muted-foreground">Banked</p><p className="num mt-1 font-semibold text-banked">{cash(alloc.banked)}</p></div>
          </div>
          <Progress aria-label="Progress to bank trigger" className="mt-3" value={alloc.progressPct} />
          <p className="mt-1 text-xs text-muted-foreground">Banks profits at {cash(alloc.trigger)}</p>
        </div>

        <div className="flex flex-wrap items-end justify-between gap-3 border-t pt-4">
          <div className="space-y-1">
            <Label htmlFor="bot-loss">Daily loss limit ($)</Label>
            <div className="flex gap-2">
              <Input id="bot-loss" type="number" inputMode="decimal" className="w-28" value={lossDraft} onChange={(e) => setLossDraft(e.target.value)} />
              <Button size="sm" variant="outline" disabled={busy || !(Number(lossDraft) > 0)} onClick={() => persist({ max_daily_loss: Number(lossDraft) })}>Save</Button>
            </div>
          </div>
          {settings.kill_switch
            ? <p className="text-sm font-medium text-destructive">Kill switch on — turn Enabled back on to resume</p>
            : <Button variant="destructive" size="sm" disabled={busy} onClick={() => { if (confirm("Stop the bot now? It cancels its working order, sells its open position and turns itself off.")) persist({ kill_switch: true }); }}>Kill switch</Button>}
        </div>

        <div className="border-t pt-4">
          <h3 className="mb-2 text-sm font-medium">Run health</h3>
          <p className="text-sm text-muted-foreground">
            {stats.total ? `${(stats.successRate * 100).toFixed(1)}% of the last ${stats.total} checks succeeded • average ${(stats.avgDurationMs / 1000).toFixed(1)}s per check` : "No checks recorded yet"}
            {data.state?.last_success_at && <> • last success {time(data.state.last_success_at)}</>}
          </p>
          {stats.failures > 0 && (
            <div className="mt-3 max-h-40 overflow-y-auto">
              {data.runs.filter((r) => !r.ok).slice(0, 5).map((r) => (
                <p key={r.started_at} className="border-b py-2 text-xs text-destructive">{time(r.started_at)} — {r.error}</p>
              ))}
            </div>
          )}
          {data.errors.length > 0 && (
            <div className="mt-3">
              <h4 className="mb-1 text-xs font-semibold text-muted-foreground">Recent errors</h4>
              <div className="max-h-40 overflow-y-auto">
                {data.errors.slice(0, 5).map((e) => (
                  <p key={e.created_at + e.where} className="border-b py-2 text-xs text-muted-foreground">{time(e.created_at)} • {e.where} — {e.message}</p>
                ))}
              </div>
            </div>
          )}
        </div>

        <Button asChild variant="outline" className="w-full justify-between">
          <Link to="/iwm">Open full bot screen<ChevronRight /></Link>
        </Button>
      </section>

      <SeparateBots userId={user.id} />
      <Button asChild variant="ghost" className="h-auto w-full justify-start gap-3 border py-4">
        <Link to="/strategies">
          <Library className="size-5 text-primary" />
          <span className="min-w-0 whitespace-normal text-left">Strategy library<span className="mt-0.5 block text-xs font-normal text-muted-foreground">864 setups the engine tests nightly — research only, they don't trade</span></span>
        </Link>
      </Button>
    </div>
  );
}
