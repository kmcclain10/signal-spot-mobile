import { createFileRoute, Link } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { passwordUpdate, sendPasswordSetup } from '@/lib/auth-actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { publicHead } from '@/lib/public-content';
import { NEW_PASSWORD_MIN, PASSWORD_MAX } from '@/lib/signup-rules';

export const Route = createFileRoute('/reset-password')({
  staticData: { sitemap: false },
  head: () => { const head = publicHead('Set your password', 'Securely recover access to The Signal Spot rule-based alerts and optional published-rule automation.', '/reset-password'); return { ...head, meta: [...head.meta, { name: 'robots', content: 'noindex' }] }; },
  component: ResetPassword,
});
function ResetPassword() {
  const [ready, setReady] = useState(false), [checking, setChecking] = useState(true), [done, setDone] = useState(false), [password, setPassword] = useState(''), [repeat, setRepeat] = useState(''), [email, setEmail] = useState(''), [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  useEffect(() => {
    let active = true;
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const recovery = hash.get('type') === 'recovery' || sessionStorage.getItem('pulse-password-recovery') === '1';
    if (recovery) sessionStorage.setItem('pulse-password-recovery', '1');
    supabase.auth.getUser().then(({ data, error }) => {
      if (!active) return;
      setReady(recovery && !error && !!data.user); setChecking(false);
      if (hash.has('error_description')) setMessage(hash.get('error_description') ?? 'The link is invalid or expired.');
    });
    return () => { active = false; };
  }, []);
  async function save(e: React.FormEvent) {
    e.preventDefault(); if (!ready) return;
    setBusy(true); setMessage('');
    try {
      const { error } = await supabase.auth.updateUser(passwordUpdate(password, repeat));
      if (error) throw error;
      setPassword(''); setRepeat(''); sessionStorage.removeItem('pulse-password-recovery');
      window.history.replaceState(null, '', '/reset-password'); setDone(true);
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Could not save password. Request a new link.'); } finally { setBusy(false); }
  }
  async function request(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMessage('');
    try { await sendPasswordSetup(email.trim()); setMessage('If this email has an account, a secure password link is on its way.'); }
    catch (e) { setMessage(e instanceof Error ? e.message : 'Could not send email.'); } finally { setBusy(false); }
  }
  return <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center space-y-5 px-5 py-10"><h1 className="text-2xl font-semibold">{done ? 'Password saved' : 'Set your password'}</h1>{checking ? <p role="status">Checking your secure link…</p> : done ? <><p>Use your new password to sign in and confirm bot adjustments.</p><Button asChild><Link to="/settings">Return to Settings</Link></Button></> : ready ? <form onSubmit={save} className="space-y-4"><Label htmlFor="recovery-password">New password</Label><Input id="recovery-password" type="password" autoComplete="new-password" minLength={NEW_PASSWORD_MIN} maxLength={PASSWORD_MAX} required value={password} onChange={e => setPassword(e.target.value)} /><Label htmlFor="recovery-repeat">Confirm password</Label><Input id="recovery-repeat" type="password" autoComplete="new-password" maxLength={PASSWORD_MAX} required value={repeat} onChange={e => setRepeat(e.target.value)} /><Button disabled={busy}>Save password</Button></form> : <><p className="text-sm text-muted-foreground">Open the secure link from your email. If it expired, request another.</p><form onSubmit={request} className="space-y-3"><Label htmlFor="recovery-email">Email</Label><Input id="recovery-email" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} /><Button disabled={busy}>Send password link</Button></form></>}{message && <p role="status" className="text-sm">{message}</p>}<Button variant="ghost" asChild><Link to="/auth">Back to sign in</Link></Button><Button variant="link" asChild><Link to="/">Back to The Signal Spot</Link></Button></main>;
}