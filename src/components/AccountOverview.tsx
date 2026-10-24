import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Bell, LockKeyhole, LogOut, ShieldCheck, Smartphone, UserRound } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getAccountSummary } from "@/lib/account.functions";
import { getIwmScreen, saveIwmSettings } from "@/lib/iwm.functions";
import { useBotNotifications } from "@/hooks/use-bot-notifications";
import { Disclosures, useAccountConfirmation } from "@/components/AccountSecurity";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

interface InstallEvent extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }
export function AccountOverview() {
  const [identity, setIdentity] = useState<{ id: string; email: string; name: string } | null>(null);
  const [killOpen, setKillOpen] = useState(false), [busy, setBusy] = useState(false), [install, setInstall] = useState<InstallEvent | null>(null), [installed, setInstalled] = useState(false);
  const qc = useQueryClient(), navigate = useNavigate(), confirmation = useAccountConfirmation();
  const account = useQuery({ queryKey: ["account-summary"], queryFn: () => getAccountSummary() });
  const bot = useQuery({ queryKey: ["iwm-screen"], queryFn: () => getIwmScreen() });
  const save = useServerFn(saveIwmSettings);
  const notifications = useBotNotifications(identity?.id);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => { if (data.user) setIdentity({ id: data.user.id, email: data.user.email ?? "", name: String(data.user.user_metadata?.full_name ?? data.user.user_metadata?.name ?? "Your account") }); });
    const capture = (e: Event) => { e.preventDefault(); setInstall(e as InstallEvent); };
    const didInstall = () => { setInstalled(true); setInstall(null); };
    setInstalled(window.matchMedia("(display-mode: standalone)").matches);
    window.addEventListener("beforeinstallprompt", capture); window.addEventListener("appinstalled", didInstall);
    return () => { window.removeEventListener("beforeinstallprompt", capture); window.removeEventListener("appinstalled", didInstall); };
  }, []);
  async function stop() {
    setBusy(true);
    try { await save({ data: { kill_switch: true } }); await qc.invalidateQueries({ queryKey: ["iwm-screen"] }); await qc.invalidateQueries({ queryKey: ["bots-overview"] }); setKillOpen(false); toast.success("IWM kill switch activated"); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Could not stop the bot"); } finally { setBusy(false); }
  }
  return <div className="space-y-7">
    <section className="flex items-center gap-3 border-b pb-5"><UserRound className="size-8 shrink-0 text-primary" /><div className="min-w-0"><h2 className="font-semibold">{identity?.name ?? "Your account"}</h2><p className="break-all text-sm text-muted-foreground">{identity?.email}</p></div></section>
    <section className="space-y-3"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">Alpaca account</h2><Button variant="ghost" size="sm" asChild><Link to="/connections">Connections</Link></Button></div>
      {account.isPending ? <p role="status" className="text-sm text-muted-foreground">Checking connection…</p> : account.error ? <p role="alert" className="text-sm text-destructive">Account details unavailable</p> : !account.data?.connected ? <p className="text-sm text-muted-foreground">No connected paper account</p> : <><div className="grid grid-cols-2 gap-4 sm:grid-cols-4"><div><p className="text-xs text-muted-foreground">Mode</p><p className="mt-1 font-semibold text-gain">PAPER</p></div><div><p className="text-xs text-muted-foreground">Account</p><p className="num mt-1">{account.data.lastFour ? `•••• ${account.data.lastFour}` : "Unavailable"}</p></div><div><p className="text-xs text-muted-foreground">Options level</p><p className="num mt-1">{account.data.optionsLevel ?? "Unavailable"}</p></div><div><p className="text-xs text-muted-foreground">Status</p><p className="mt-1 break-words text-sm">{account.data.status ?? "Unavailable"}</p></div></div>{account.data.error && <p className="text-sm text-warning">{account.data.error}</p>}</>}
    </section>
    <section className="space-y-3 border-t pt-5"><h2 className="flex items-center gap-2 font-semibold"><ShieldCheck className="size-4 text-primary" />IWM safety</h2><p className="text-sm text-muted-foreground">Paper-only. The kill switch stops new entries and asks the runner to cancel or close the bot’s own orders and positions. Manual trades are not affected.</p>{bot.data?.settings?.kill_switch ? <p className="text-sm font-semibold text-destructive">Kill switch on — resume from Bots after password confirmation</p> : <Button variant="destructive" disabled={busy || !bot.data?.settings} onClick={() => setKillOpen(true)}>IWM kill switch</Button>}<Button variant="outline" asChild className="ml-2"><Link to="/bots">Bots</Link></Button></section>
    <section className="space-y-3 border-t pt-5"><h2 className="flex items-center gap-2 font-semibold"><LockKeyhole className="size-4 text-primary" />Security</h2><p className="text-sm text-muted-foreground">Password confirmation protects risk changes, LIVE selection and kill-switch removal. After 15 minutes in the background, this device signs out; your enabled paper bot keeps running.</p><Button variant="outline" onClick={async () => { if (await confirmation()) toast.success("Password confirmed"); }}>Confirm password</Button></section>
    <section className="space-y-3 border-t pt-5"><h2 className="flex items-center gap-2 font-semibold"><Bell className="size-4 text-primary" />Notifications</h2><div className="flex items-center justify-between gap-3"><label htmlFor="account-notifications" className="text-sm">Bot trades and banking</label><Switch id="account-notifications" checked={notifications.enabled} disabled={!notifications.supported} onCheckedChange={async value => { if (!await notifications.toggle(value)) toast.error("Notifications are unavailable or blocked on this device."); }} /></div><p className="text-xs text-muted-foreground">Device-local alerts while the app is open. Background push and native iPhone notifications are not connected.</p></section>
    <section className="space-y-3 border-t pt-5"><h2 className="flex items-center gap-2 font-semibold"><Smartphone className="size-4 text-primary" />On your phone</h2>{installed ? <p className="text-sm text-gain">Opened as a home-screen app</p> : install ? <Button variant="outline" onClick={async () => { await install.prompt(); await install.userChoice; setInstall(null); }}>Add to home screen</Button> : <p className="text-sm text-muted-foreground">Open the published app in Safari on iPhone, then Share → Add to Home Screen. On Android, use your browser’s Install app or Add to Home Screen option.</p>}<p className="text-xs text-muted-foreground">Internet is required. This is a web app, not an App Store app; Face ID is not connected.</p></section>
    <section className="space-y-3 border-t pt-5"><h2 className="font-semibold">Disclosures</h2><Disclosures /></section>
    <Button variant="outline" onClick={async () => { setBusy(true); const r = await supabase.auth.signOut({ scope: "global" }); if (r.error) { toast.error("Could not sign out. Try again."); setBusy(false); return; } await qc.cancelQueries(); qc.clear(); await navigate({ to: "/auth", replace: true }); }} disabled={busy}><LogOut />Sign out of all devices</Button>
    <Dialog open={killOpen} onOpenChange={setKillOpen}><DialogContent><DialogHeader><DialogTitle>Stop IWM automation?</DialogTitle><DialogDescription>The runner will cancel the bot’s working entry and close its open position at its next check. Manual positions stay open.</DialogDescription></DialogHeader><div className="flex gap-2"><Button variant="outline" disabled={busy} onClick={() => setKillOpen(false)}>Cancel</Button><Button variant="destructive" disabled={busy} onClick={stop}>Activate kill switch</Button></div></DialogContent></Dialog>
  </div>;
}