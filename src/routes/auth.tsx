import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Activity } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { magicLinkOptions } from '@/lib/auth-actions';

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Pulse Signals" },
      { name: "description", content: "Sign in to Pulse Signals, your Holly-style day-trading assistant." },
      { property: "og:title", content: "Sign in — Pulse Signals" },
      { property: "og:description", content: "Nightly strategy picks, live signals and one-tap paper trades." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('');
  const [method, setMethod] = useState<'password' | 'magic'>('password');
  const [message, setMessage] = useState('');

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (sessionStorage.getItem('pulse-password-recovery') === '1' || new URLSearchParams(window.location.hash.slice(1)).get('type') === 'recovery') navigate({ to: '/reset-password', replace: true });
      else if (data.user) navigate({ to: "/", replace: true });
    });
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      if (method === 'magic') {
        const { error } = await supabase.auth.signInWithOtp({ email: email.trim(), options: magicLinkOptions(window.location.origin, mode === 'up', name) });
        if (error) throw error;
        setMessage(mode === 'up' ? 'Check your email to confirm your account and sign in. You can add a password in Settings.' : 'Check your email for your sign-in link.');
        return;
      }
      if (mode === "in") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/", replace: true });
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin, data: { full_name: name.trim() } },
        });
        if (error) throw error;
        if (data.session) navigate({ to: "/", replace: true });
        else setMessage("Check your email to confirm your account before signing in.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-lg border bg-card p-6">
        <div className="mb-6 flex items-center gap-2">
          <Activity className="size-5 text-primary" />
          <span className="text-lg font-semibold">Pulse Signals</span>
        </div>
        <h1 className="mb-4 text-xl font-semibold">{mode === 'up' ? 'Create your account' : 'Welcome back'}</h1>
        <div className="mb-4 grid grid-cols-2 gap-1 rounded-md border p-1"><Button variant={method === 'password' ? 'secondary' : 'ghost'} disabled={busy} onClick={() => setMethod('password')}>Password</Button><Button variant={method === 'magic' ? 'secondary' : 'ghost'} disabled={busy} onClick={() => setMethod('magic')}>Magic link</Button></div>
        <form onSubmit={submit} className="space-y-4">
          {mode === 'up' && <div className="space-y-1.5"><Label htmlFor="signup-name">Full name</Label><Input id="signup-name" autoComplete="name" maxLength={100} required value={name} onChange={e => setName(e.target.value)} /></div>}
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          {method === 'password' && <div className="space-y-1.5">
            <Label htmlFor="pw">Password</Label>
            <Input id="pw" type="password" autoComplete={mode === 'up' ? 'new-password' : 'current-password'} required minLength={mode === 'up' ? 8 : 1} value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>}
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? 'Please wait…' : method === 'magic' ? (mode === 'up' ? 'Create account with magic link' : 'Send sign-in link') : mode === "in" ? "Sign in" : "Create account"}
          </Button>
        </form>
        {message && <p role="status" className="mt-4 text-sm text-gain">{message}</p>}
        <Button variant="ghost" asChild className="mt-2 w-full"><Link to="/reset-password">Forgot password or need one?</Link></Button>
        <Button variant="ghost" disabled={busy}
          className="mt-4 w-full text-center text-sm text-muted-foreground hover:text-foreground"
          onClick={() => { setMode(mode === "in" ? "up" : "in"); setMessage(''); }}
        >
          {mode === "in" ? "No account? Create one" : "Have an account? Sign in"}
        </Button>
      </div>
    </div>
  );
}
