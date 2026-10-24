import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSettings } from "@/hooks/use-app-data";
import { ErrorState, LoadingRows, PageHeader, Panel } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { AccountOverview } from "@/components/AccountOverview";
import { useAccountConfirmation } from "@/components/AccountSecurity";
import { sensitiveAccountChange } from "@/lib/account-rules";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Account & Security — Pulse Signals" },
      { name: "description", content: "Your connected paper account, security, disclosures, notifications and risk settings." },
      { property: "og:title", content: "Account & Security — Pulse Signals" },
      { property: "og:description", content: "Manage account security and paper trading safeguards." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SettingsPage,
});

type Form = {
  watchlist: string[];
  lookback_days: number;
  min_trades: number;
  min_win_rate_pct: number;
  min_profit_factor: number;
  risk_per_trade_usd: number;
  max_open_positions: number;
  max_daily_loss_usd: number;
  trading_mode: "paper" | "live";
};

function NumField({ label, value, onChange, step = 1, suffix }: { label: string; value: number; onChange: (n: number) => void; step?: number; suffix?: string }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="relative">
        <Input type="number" step={step} min={0} value={value} onChange={(e) => onChange(Number(e.target.value))} className="num pr-10" />
        {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{suffix}</span>}
      </div>
    </div>
  );
}

function SettingsPage() {
  const confirmation = useAccountConfirmation();
  const s = useSettings();
  const qc = useQueryClient();
  const [f, setF] = useState<Form | null>(null);
  const [ticker, setTicker] = useState("");
  const [liveOpen, setLiveOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  useEffect(() => {
    if (s.data && !f)
      setF({
        watchlist: s.data.watchlist,
        lookback_days: s.data.lookback_days,
        min_trades: s.data.min_trades,
        min_win_rate_pct: Math.round(Number(s.data.min_win_rate) * 100),
        min_profit_factor: Number(s.data.min_profit_factor),
        risk_per_trade_usd: Number(s.data.risk_per_trade_usd),
        max_open_positions: s.data.max_open_positions,
        max_daily_loss_usd: Number(s.data.max_daily_loss_usd),
        trading_mode: s.data.trading_mode as "paper" | "live",
      });
  }, [s.data, f]);

  const save = useMutation({
    mutationFn: async (form: Form) => {
      if (s.data && sensitiveAccountChange(s.data, form) && !await confirmation()) return false;
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Sign in again to save your settings.");
      const { error } = await supabase
        .from("settings")
        .update({
          watchlist: form.watchlist,
          lookback_days: form.lookback_days,
          min_trades: form.min_trades,
          min_win_rate: form.min_win_rate_pct / 100,
          min_profit_factor: form.min_profit_factor,
          risk_per_trade_usd: form.risk_per_trade_usd,
          max_open_positions: form.max_open_positions,
          max_daily_loss_usd: form.max_daily_loss_usd,
          trading_mode: form.trading_mode,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", u.user.id);
      if (error) throw error;
      return true;
    },
    onSuccess: (saved) => {
      if (!saved) return;
      qc.invalidateQueries({ queryKey: ["settings"] });
      toast.success("Saved — the engine uses these on its next run.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Save failed"),
  });

  if (s.isLoading || (!f && !s.error)) return <LoadingRows />;
  if (s.error || !f) return <ErrorState error={s.error} onRetry={() => s.refetch()} />;
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF({ ...f, [k]: v });

  function addTicker() {
    if (!f) return;
    const parts = ticker.toUpperCase().split(/[\s,]+/).filter(Boolean);
    const bad = parts.filter((p) => !/^[A-Z]{1,5}$/.test(p));
    if (bad.length) { toast.error(`Invalid ticker: ${bad.join(", ")}`); return; }
    const next = Array.from(new Set([...f.watchlist, ...parts]));
    if (next.length > 50) { toast.error("Max 50 tickers"); return; }
    set("watchlist", next);
    setTicker("");
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Account" />
      <AccountOverview />
      <h2 className="border-t pt-6 text-xl font-semibold">Trading preferences</h2>

      <Panel className="p-4">
        <h2 className="mb-3 text-sm font-semibold">Watchlist <span className="num text-xs font-normal text-muted-foreground">{f.watchlist.length}/50</span></h2>
        <div className="mb-3 flex flex-wrap gap-2">
          {f.watchlist.map((t) => (
            <span key={t} className="num inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs">
              {t}
              <Button size="icon" variant="ghost" className="size-7" aria-label={`Remove ${t}`} onClick={() => set("watchlist", f.watchlist.filter((x) => x !== t))}><X className="size-3" /></Button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <Input placeholder="Add tickers, e.g. GOOG, NFLX" value={ticker} onChange={(e) => setTicker(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTicker(); } }} className="num uppercase" />
          <Button variant="outline" onClick={addTicker}>Add</Button>
        </div>
      </Panel>

      <Panel className="p-4">
        <h2 className="mb-3 text-sm font-semibold">Selection rule</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <NumField label="Lookback" suffix="days" value={f.lookback_days} onChange={(v) => set("lookback_days", v)} />
          <NumField label="Min trades" value={f.min_trades} onChange={(v) => set("min_trades", v)} />
          <NumField label="Min win rate" suffix="%" value={f.min_win_rate_pct} onChange={(v) => set("min_win_rate_pct", v)} />
          <NumField label="Min profit factor" step={0.1} value={f.min_profit_factor} onChange={(v) => set("min_profit_factor", v)} />
        </div>
      </Panel>

      <Panel className="p-4">
        <h2 className="mb-3 text-sm font-semibold">Risk</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <NumField label="Risk per trade" suffix="$" value={f.risk_per_trade_usd} onChange={(v) => set("risk_per_trade_usd", v)} />
          <NumField label="Max open positions" value={f.max_open_positions} onChange={(v) => set("max_open_positions", v)} />
          <NumField label="Max daily loss" suffix="$" value={f.max_daily_loss_usd} onChange={(v) => set("max_daily_loss_usd", v)} />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Order size = risk per trade ÷ distance from entry to stop. New orders are blocked once the daily loss limit is hit.</p>
      </Panel>

      <Panel className="p-4">
        <h2 className="mb-3 text-sm font-semibold">Trading mode</h2>
        <div className="grid max-w-xs grid-cols-2 gap-1 rounded-md border p-1">
          <Button variant="ghost" onClick={() => set("trading_mode", "paper")} className={cn(f.trading_mode === "paper" ? "bg-accent" : "text-muted-foreground")}>Paper</Button>
          <Button variant="ghost" onClick={() => { setConfirmText(""); setLiveOpen(true); }} className={cn(f.trading_mode === "live" ? "bg-loss text-destructive-foreground" : "text-muted-foreground")}>Live</Button>
        </div>
      </Panel>

      <Button onClick={() => save.mutate(f)} disabled={save.isPending}>{save.isPending ? "Saving…" : "Save settings"}</Button>

      <Dialog open={liveOpen} onOpenChange={setLiveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-loss"><AlertTriangle className="size-5" /> Switch to live trading?</DialogTitle>
            <DialogDescription>
              Live orders use real money. The backtest showed picks that won 67% in-sample won only 29% the next day. Paper trade for at least a month first.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>Type LIVE to confirm</Label>
            <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} className="num" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLiveOpen(false)}>Cancel</Button>
            <Button variant="destructive" disabled={confirmText !== "LIVE"} onClick={() => { set("trading_mode", "live"); setLiveOpen(false); toast.warning("Live mode selected — press Save to apply."); }}>
              Enable live
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
