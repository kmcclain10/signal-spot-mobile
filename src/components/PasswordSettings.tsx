import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { passwordUpdate } from '@/lib/auth-actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function PasswordSettings() {
  const [password, setPassword] = useState(''), [repeat, setRepeat] = useState(''), [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMessage('');
    try {
      const { error } = await supabase.auth.updateUser(passwordUpdate(password, repeat)); if (error) throw error;
      setPassword(''); setRepeat(''); setMessage('Password saved. Use it to confirm bot changes.');
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Could not save password.'); } finally { setBusy(false); }
  }
  return <form onSubmit={save} className="max-w-md space-y-3"><p className="text-sm text-muted-foreground">Add or change your password right here — no email needed.</p><Label htmlFor="new-password">New password</Label><Input id="new-password" type="password" autoComplete="new-password" required value={password} onChange={e => setPassword(e.target.value)} /><Label htmlFor="repeat-password">Confirm password</Label><Input id="repeat-password" type="password" autoComplete="new-password" required value={repeat} onChange={e => setRepeat(e.target.value)} /><Button disabled={busy}>Save password</Button>{message && <p role="status" className="text-sm">{message}</p>}</form>;
}
