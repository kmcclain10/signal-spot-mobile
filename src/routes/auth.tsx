import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Brand } from "@/components/Brand";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { lovable } from '@/integrations/lovable';
import { LegalLinks } from '@/components/SiteFooter';
import { PUBLIC_DESCRIPTION, publicHead } from '@/lib/public-content';
import { NEW_PASSWORD_MIN, PASSWORD_MAX, validateSignup } from '@/lib/signup-rules';

export const Route = createFileRoute("/auth")({
  staticData: { sitemap: false },
  head: () => publicHead('Sign in', PUBLIC_DESCRIPTION, '/auth'),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [accepted, setAccepted] = useState(false);

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
      if (mode === "in") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/", replace: true });
      } else {
        validateSignup(password, accepted);
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin, data: { full_name: name.trim(), signup_legal_version: '2026-11-20', signup_legal_accepted_at: new Date().toISOString() } },
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

  async function social(provider: 'apple' | 'google') {
    if (mode === 'up' && !accepted) { toast.error('Agree to the Terms, Privacy Policy and Risk disclosure before creating an account.'); return; }
    setBusy(true);
    try {
      const r = await lovable.auth.signInWithOAuth(provider, { redirect_uri: window.location.origin });
      if (r.error) throw r.error;
      if (r.redirected) return;
      navigate({ to: '/', replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Sign in failed');
    } finally { setBusy(false); }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-lg border bg-card p-6">
        <Link to="/welcome" className="mb-6 inline-flex" aria-label="The Signal Spot home"><Brand /></Link>
        <h1 className="mb-4 text-xl font-semibold">{mode === 'up' ? 'Create your account' : 'Welcome back'}</h1>
        <div className="mb-4 space-y-2">
          <Button type="button" className="w-full" disabled={busy} onClick={() => social('apple')}><svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden><path d="M16.37 12.6c-.02-2.3 1.88-3.4 1.97-3.46-1.07-1.57-2.74-1.78-3.33-1.8-1.42-.15-2.77.83-3.49.83-.72 0-1.83-.81-3-.79-1.55.02-2.97.9-3.77 2.28-1.6 2.78-.41 6.9 1.15 9.16.76 1.1 1.67 2.34 2.86 2.3 1.15-.05 1.58-.74 2.97-.74s1.78.74 2.99.72c1.24-.02 2.02-1.12 2.78-2.23.87-1.28 1.23-2.52 1.25-2.58-.03-.01-2.4-.92-2.42-3.66zM14.08 5.84c.63-.77 1.06-1.83.94-2.9-.91.04-2.02.61-2.67 1.37-.58.67-1.1 1.76-.96 2.8 1.02.08 2.06-.52 2.69-1.27z"/></svg>Continue with Apple</Button>
          <Button type="button" variant="outline" className="w-full" disabled={busy} onClick={() => social('google')}><svg viewBox="0 0 24 24" className="size-4" aria-hidden><path fill="currentColor" d="M21.6 12.23c0-.68-.06-1.36-.18-2.02H12v3.83h5.38a4.6 4.6 0 0 1-2 3.02v2.5h3.24c1.9-1.75 2.98-4.33 2.98-7.33zM12 22c2.7 0 4.97-.9 6.62-2.43l-3.24-2.5c-.9.6-2.04.96-3.38.96-2.6 0-4.8-1.76-5.59-4.12H3.08v2.58A10 10 0 0 0 12 22zM6.41 13.9a6 6 0 0 1 0-3.8V7.52H3.08a10 10 0 0 0 0 8.96l3.33-2.58zM12 5.98c1.47 0 2.79.5 3.83 1.5l2.87-2.87A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.92 5.52l3.33 2.58C7.2 7.74 9.4 5.98 12 5.98z"/></svg>Continue with Google</Button>
          <p className="text-center text-xs text-muted-foreground">or use email</p>
        </div>
        <form onSubmit={submit} className="space-y-4">
          {mode === 'up' && <div className="space-y-1.5"><Label htmlFor="signup-name">Full name</Label><Input id="signup-name" autoComplete="name" maxLength={100} required value={name} onChange={e => setName(e.target.value)} /></div>}
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pw">Password</Label>
            <Input id="pw" type="password" autoComplete={mode === 'up' ? 'new-password' : 'current-password'} required minLength={mode === 'up' ? NEW_PASSWORD_MIN : 1} maxLength={PASSWORD_MAX} value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          {mode === 'up' && <div className="flex items-start gap-3 text-xs leading-5"><input id="signup-legal" type="checkbox" required checked={accepted} onChange={e => setAccepted(e.target.checked)} className="mt-1 size-4 shrink-0 accent-primary" aria-label="Agree to Terms, Privacy Policy and Risk disclosure" /><div><label htmlFor="signup-legal">By creating an account, you agree to our </label><LegalLinks />.</div></div>}
          <Button type="submit" className="w-full" disabled={busy || mode === 'up' && !accepted}>
            {busy ? 'Please wait…' : mode === "in" ? "Sign in" : "Create account"}
          </Button>
        </form>
        {mode === 'in' && <p className="mt-3 text-xs leading-5 text-muted-foreground">Creating an account? Choose “No account? Create one” to review and accept our terms first.</p>}
        {message && <p role="status" className="mt-4 text-sm text-gain">{message}</p>}
        <Button variant="ghost" asChild className="mt-2 w-full"><Link to="/reset-password">Forgot password or need one?</Link></Button>
        <Button variant="ghost" disabled={busy}
          className="mt-4 w-full text-center text-sm text-muted-foreground hover:text-foreground"
          onClick={() => { setMode(mode === "in" ? "up" : "in"); setMessage(''); }}
        >
          {mode === "in" ? "No account? Create one" : "Have an account? Sign in"}
        </Button>
        <Button variant="link" asChild className="mt-2 w-full"><Link to="/welcome">Back to The Signal Spot</Link></Button>
      </div>
    </div>
  );
}
