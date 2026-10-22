import { Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  Activity,
  BarChart3,
  CandlestickChart,
  Home,
  Library,
  LogOut,
  Menu,
  Plug,
  Radio,
  Settings,
  Wallet,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSettings } from "@/hooks/use-app-data";
import { marketStatus } from "@/lib/market-hours";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

const NAV = [
  { to: "/", label: "Today", icon: Home },
  { to: "/trade", label: "Trade", icon: CandlestickChart },
  { to: "/signals", label: "Signals", icon: Radio },
  { to: "/strategies", label: "Strategies", icon: Library },
  { to: "/performance", label: "Performance", icon: BarChart3 },
  { to: "/orders", label: "Orders", icon: Wallet },
  { to: "/connections", label: "Connections", icon: Plug },
  { to: "/settings", label: "Settings", icon: Settings },
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
  useEffect(() => {
    setSt(marketStatus());
    const t = setInterval(() => setSt(marketStatus()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!st) return <span className="h-6 w-32" />;
  const color = st.phase === "open" ? "bg-gain" : st.phase === "pre" ? "bg-warning" : "bg-muted-foreground";
  return (
    <span className="flex items-center gap-2 text-xs">
      <span className={cn("size-2 rounded-full", color, st.phase === "open" && "animate-pulse")} />
      <span className="font-medium">{st.label}</span>
      <span className="num hidden text-muted-foreground sm:inline">{st.countdown}</span>
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

function NavLink({ to, label, icon: Icon, onClick }: (typeof NAV)[number] & { onClick?: () => void }) {
  return (
    <Link
      to={to}
      onClick={onClick}
      activeOptions={{ exact: to === "/" }}
      className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      activeProps={{ className: "bg-accent text-foreground" }}
    >
      <Icon className="size-4" />
      {label}
    </Link>
  );
}

export function AppShell() {
  const signOut = useSignOut();
  const [more, setMore] = useState(false);
  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 hidden w-56 flex-col border-r bg-sidebar p-3 lg:flex">
        <div className="mb-6 flex items-center gap-2 px-3 pt-2">
          <Activity className="size-5 text-primary" />
          <span className="font-semibold">Pulse Signals</span>
        </div>
        <nav className="flex flex-1 flex-col gap-1">
          {NAV.map((n) => (
            <NavLink key={n.to} {...n} />
          ))}
        </nav>
        <button
          onClick={signOut}
          className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <LogOut className="size-4" /> Sign out
        </button>
      </aside>

      <div className="lg:pl-56">
        <header className="sticky top-0 z-20 flex h-12 items-center justify-between border-b bg-background/90 px-4 backdrop-blur">
          <div className="flex items-center gap-2 lg:hidden">
            <Activity className="size-4 text-primary" />
            <span className="text-sm font-semibold">Pulse</span>
          </div>
          <MarketStatus />
          <ModeBadge />
        </header>
        <main className="mx-auto max-w-6xl px-4 pb-24 pt-5 lg:pb-10">
          <Outlet />
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t bg-sidebar lg:hidden">
        {NAV.slice(0, 4).map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            activeOptions={{ exact: to === "/" }}
            className="flex flex-col items-center gap-1 py-2 text-[11px] text-muted-foreground"
            activeProps={{ className: "text-primary" }}
          >
            <Icon className="size-5" />
            {label}
          </Link>
        ))}
        <button onClick={() => setMore(true)} className="flex flex-col items-center gap-1 py-2 text-[11px] text-muted-foreground">
          <Menu className="size-5" />
          More
        </button>
      </nav>

      <Sheet open={more} onOpenChange={setMore}>
        <SheetContent side="bottom">
          <SheetHeader>
            <SheetTitle>More</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col gap-1 p-2">
            {NAV.slice(4).map((n) => (
              <NavLink key={n.to} {...n} onClick={() => setMore(false)} />
            ))}
            <button
              onClick={signOut}
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent"
            >
              <LogOut className="size-4" /> Sign out
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
