import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { LockKeyhole } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { BACKGROUND_LOCK_MS, backgroundLockDue, DISCLOSURE_VERSION } from "@/lib/account-rules";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

const Confirmation = createContext<() => Promise<boolean>>(async () => false);
export const useAccountConfirmation = () => useContext(Confirmation);
export function Disclosures() {
  return <div className="space-y-3 text-sm text-muted-foreground"><p><strong className="text-foreground">Not investment advice.</strong> Pulse Signals provides trading tools, not personalized investment recommendations. Trading can lose money.</p><p><strong className="text-foreground">Paper trading.</strong> Simulated orders, fills and returns do not represent real-money results. IWM automation is paper-only. Banking shown by the bot is accounting, not a money transfer.</p><a className="inline-flex min-h-11 items-center text-primary underline" href="https://alpaca.markets/disclosures" target="_blank" rel="noopener noreferrer">Alpaca disclosures</a></div>;
}
export function AccountSecurity({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false), [password, setPassword] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [legal, setLegal] = useState<"loading" | "required" | "accepted">("loading");
  const pending = useRef<((ok: boolean) => void) | null>(null);
  const qc = useQueryClient(), navigate = useNavigate();
  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const r = await supabase.from("account_disclosure_acceptance").select("version").eq("user_id", data.user.id).maybeSingle();
      if (active) setLegal(!r.error && r.data?.version === DISCLOSURE_VERSION ? "accepted" : "required");
    });
    return () => { active = false; pending.current?.(false); };
  }, []);
  useEffect(() => {
    let hiddenAt: number | null = document.hidden ? Date.now() : null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let locking = false;
    async function lock() {
      if (locking) return;
      locking = true;
      await qc.cancelQueries(); qc.clear();
      await supabase.auth.signOut({ scope: "local" });
      await navigate({ to: "/auth", replace: true });
    }
    const change = () => {
      if (document.hidden) { hiddenAt = Date.now(); timer = setTimeout(() => void lock(), BACKGROUND_LOCK_MS); }
      else { if (timer) clearTimeout(timer); if (backgroundLockDue(hiddenAt, Date.now())) void lock(); hiddenAt = null; }
    };
    document.addEventListener("visibilitychange", change);
    window.addEventListener("pageshow", change);
    return () => { if (timer) clearTimeout(timer); document.removeEventListener("visibilitychange", change); window.removeEventListener("pageshow", change); };
  }, [qc, navigate]);
  function close(ok: boolean) { setOpen(false); setPassword(""); setError(""); pending.current?.(ok); pending.current = null; }
  function confirm() { pending.current?.(false); setError(""); setPassword(""); setOpen(true); return new Promise<boolean>(resolve => { pending.current = resolve; }); }
  async function verify(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError("");
    try {
      const { data } = await supabase.auth.getUser();
      if (!data.user?.email) throw new Error("Sign in again to confirm your account.");
      const r = await supabase.auth.signInWithPassword({ email: data.user.email, password });
      if (r.error) throw new Error("Password confirmation failed. If you use magic links, add a password in Settings first.");
      close(true);
    } catch (e) { setError(e instanceof Error ? e.message : "Confirmation failed"); }
    finally { setBusy(false); }
  }
  async function accept() {
    setBusy(true); setError("");
    try {
      const { data } = await supabase.auth.getUser();
      if (!data.user) throw new Error("Sign in again.");
      const { error } = await supabase.from("account_disclosure_acceptance").upsert({ user_id: data.user.id, version: DISCLOSURE_VERSION, accepted_at: new Date().toISOString() });
      if (error) throw new Error("Could not save your acceptance. Try again.");
      setLegal("accepted");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save acceptance"); } finally { setBusy(false); }
  }
  return <Confirmation.Provider value={confirm}>
    {legal === "accepted" ? children : <section className="mx-auto max-w-lg space-y-5 py-8"><h1 className="text-2xl font-semibold">Before you continue</h1><Disclosures />{legal === "loading" ? <p role="status">Checking acceptance…</p> : <Button onClick={accept} disabled={busy}>I understand and accept</Button>}{error && <p role="alert" className="text-destructive">{error}</p>}</section>}
    <Dialog open={open} onOpenChange={v => { if (!v && !busy) close(false); }}><DialogContent><DialogHeader><DialogTitle className="flex items-center gap-2"><LockKeyhole className="size-5 text-primary" />Confirm your password</DialogTitle><DialogDescription>Required before changing risk limits, enabling LIVE, or turning off the kill switch.</DialogDescription></DialogHeader><form onSubmit={verify} className="space-y-4"><Label htmlFor="confirm-password">Current password</Label><Input id="confirm-password" type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} />{error && <p role="alert" className="text-sm text-destructive">{error}</p>}<div className="flex gap-2"><Button type="button" variant="outline" disabled={busy} onClick={() => close(false)}>Cancel</Button><Button type="submit" disabled={busy}>{busy ? "Verifying…" : "Confirm password"}</Button></div></form></DialogContent></Dialog>
  </Confirmation.Provider>;
}