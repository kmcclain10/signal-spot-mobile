import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { sendPasswordSetup, passwordUpdate } from '@/lib/auth-actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function PasswordSettings() {
  const [changing, setChanging] = useState(false), [current, setCurrent] = useState(''), [password, setPassword] = useState(''), [repeat, setRepeat] = useState(''), [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  async function send() {
    setBusy(true); setMessage('');
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user?.email) throw new Error('Sign in again.');
      await sendPasswordSetup(data.user.email);
      setMessage('Check your email for a secure link to add or reset your password.');
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Could not send email.'); } finally { setBusy(false); }
  }
  async function change(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMessage('');
    try {
      const payload = passwordUpdate(password, repeat, current);
      const { error } = await supabase.auth.updateUser(payload); if (error) throw error;
      setCurrent(''); setPassword(''); setRepeat(''); setChanging(false); setMessage('Password changed. Use it to confirm bot adjustments.');
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Could not change password.'); } finally { setBusy(false); }
  }
  return <div className="space-y-3"><div className="flex flex-wrap gap-2"><Button variant="outline" disabled={busy} onClick={send}>Add or reset password by email</Button><Button variant="ghost" disabled={busy} onClick={() => setChanging(!changing)}>Change existing password</Button></div>{changing && <form onSubmit={change} className="max-w-md space-y-3"><Label htmlFor="current-password">Current password</Label><Input id="current-password" type="password" autoComplete="current-password" required value={current} onChange={e => setCurrent(e.target.value)} /><Label htmlFor="new-password">New password</Label><Input id="new-password" type="password" autoComplete="new-password" minLength={8} required value={password} onChange={e => setPassword(e.target.value)} /><Label htmlFor="repeat-password">Confirm new password</Label><Input id="repeat-password" type="password" autoComplete="new-password" required value={repeat} onChange={e => setRepeat(e.target.value)} /><Button disabled={busy}>Save password</Button></form>}{message && <p role="status" className="text-sm">{message}</p>}</div>;
}