import { Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  Activity,
  BarChart3,
  CandlestickChart,
  Home,
  Bot,
  Search,
  UserRound,
  LogOut,
  Menu,
  Plug,
  Wallet,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSettings } from "@/hooks/use-app-data";
import { marketStatus } from "@/lib/market-hours";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { AccountSecurity } from "@/components/AccountSecurity";

const NAV = [
  { to: "/", label: "Home", icon: Home },
  { to: "/explore", label: "Explore", icon: Search },
  { to: "/bots", label: "Bots", icon: Bot },
  { to: "/orders", label: "Activity", icon: Wallet },
  { to: "/settings", label: "Account", icon: UserRound },
] as const;
const SECONDARY = [
  { to: "/signals", label: "Signals", icon: Activity },
  { to: "/trade", label: "Trade", icon: CandlestickChart },
  { to: "/iwm", label: "IWM 20-Min Window", icon: Activity },
  { to: "/strategies", label: "Strategy library", icon: BarChart3 },
  { to: "/performance", label: "Performance", icon: BarChart3 },
  { to: "/connections", label: "Connections", icon: Plug },
] as const;

export function ModeBadge() {
  const s = useSettings();
  const live = s.data?.trading_mode === "live";
  return (
    <span
      className={cn(
        "num rounded-md px-2 py-0.5 text-xs font-semibold tracking-wider",
        live ? "bg-loss text-destructive-foreground" : "bg-secondary text-muted-foreground",
      )}
    >
      {live ? "LIVE" : "PAPER"}
    </span>
  );
}

export function MarketStatus() {
  const [st, setSt] = useState<ReturnType<typeof marketStatus> | null>(null);
  const [local, setLocal] = useState("");
  useEffect(() => {
    const update = () => {
      setSt(marketStatus());
      setLocal(new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(new Date()));
    };
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, []);
  if (!st) return <span className="h-6 w-32" />;
  const color = st.phase === "open" ? "bg-gain" : st.phase === "pre" ? "bg-warning" : "bg-muted-foreground";
  return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] sm:text-xs">
      <span className={cn("size-2 rounded-full", color, st.phase === "open" && "animate-pulse")} />
      <span className="font-medium">{st.label}</span>
      <span className="num hidden text-muted-foreground sm:inline">{st.countdown}</span>
      <span className="num text-muted-foreground">{local}</span>
    </span>
  );
}

function useSignOut() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  return async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };
}

function NavLink({ to, label, icon: Icon, onClick }: ((typeof NAV)[number] | (typeof SECONDARY)[number]) & { onClick?: () => void }) {
  return (
    <Link
      to={to}
      onClick={onClick}
      activeOptions={{ exact: to === "/" }}
      className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      activeProps={{ className: "bg-accent text-primary" }}
    >
      <Icon className="size-4" />
      {label}
    </Link>
  );
}

export function AppShell() {
  const signOut = useSignOut();
  const qc = useQueryClient();
  const [more, setMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [pull, setPull] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  async function refresh() {
    if (refreshing) return;
    setRefreshing(true);
    try { await qc.invalidateQueries(); } finally { setRefreshing(false); setPull(false); }
  }
  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r bg-sidebar p-4 lg:flex">
        <div className="mb-10 flex items-center gap-2 px-3 pt-4">
          <Activity className="size-5 text-primary" />
          <span className="font-semibold">Pulse Signals</span>
        </div>
        <nav className="flex flex-1 flex-col gap-2" aria-label="Main navigation">
          {NAV.map((n) => (
            <NavLink key={n.to} {...n} />
          ))}
          <div className="my-4 border-t" />
          {SECONDARY.map((n) => <NavLink key={n.to} {...n} />)}
        </nav>
        <Button variant="ghost"
          onClick={signOut}
          className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <LogOut className="size-4" /> Sign out
        </Button>
      </aside>

      <div className="lg:pl-60">
        <header className="sticky top-0 z-20 flex min-h-16 items-center justify-between gap-2 border-b bg-background/95 px-4 backdrop-blur sm:px-6">
          <div className="flex items-center gap-2 lg:hidden">
            <Activity className="size-4 text-primary" />
            <span className="text-sm font-semibold">Pulse</span>
          </div>
          <MarketStatus />
          <div className="flex items-center gap-1"><ModeBadge /><Button asChild size="icon" variant="ghost" aria-label="Trade" title="Trade"><Link to="/trade"><CandlestickChart /></Link></Button><Button size="icon" variant="ghost" aria-label="Refresh account" title="Refresh account" disabled={refreshing} onClick={refresh}><RefreshCw className={refreshing ? "animate-spin" : ""} /></Button><Button size="icon" variant="ghost" className="lg:hidden" aria-label="More pages" onClick={() => setMore(true)}><Menu /></Button></div>
        </header>
        <main className="mx-auto max-w-6xl px-4 pb-28 pt-7 sm:px-6 lg:pb-12"
          onTouchStart={e => setTouchStart(window.scrollY <= 0 ? e.touches[0]?.clientY ?? null : null)}
          onTouchMove={e => { if (touchStart !== null) setPull((e.touches[0]?.clientY ?? touchStart) - touchStart > 80); }}
          onTouchEnd={() => { setTouchStart(null); if (pull) void refresh(); }}
          onTouchCancel={() => { setTouchStart(null); setPull(false); }}>
          {(pull || refreshing) && <div role="status" className="flex items-center justify-center gap-2 pb-4 text-xs text-primary"><RefreshCw className={refreshing ? "size-4 animate-spin" : "size-4"} />{refreshing ? "Refreshing…" : "Release to refresh"}</div>}
          <AccountSecurity><Outlet /></AccountSecurity>
        </main>
      </div>

      <nav aria-label="Mobile navigation" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t bg-sidebar pb-[env(safe-area-inset-bottom)] lg:hidden">
        {NAV.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            activeOptions={{ exact: to === "/" }}
            className="flex min-h-16 flex-col items-center justify-center gap-1 py-3 text-[11px] text-muted-foreground"
            activeProps={{ className: "text-primary" }}
          >
            <Icon className="size-5" />
            {label}
          </Link>
        ))}
      </nav>

      <Sheet open={more} onOpenChange={setMore}>
        <SheetContent side="bottom">
          <SheetHeader>
            <SheetTitle>More</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col gap-1 p-2">
            {SECONDARY.map((n) => (
              <NavLink key={n.to} {...n} onClick={() => setMore(false)} />
            ))}
            <Button variant="ghost"
              onClick={signOut}
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent"
            >
              <LogOut className="size-4" /> Sign out
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
