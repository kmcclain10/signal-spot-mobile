import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function CustomerProfile() {
  const qc = useQueryClient();
  const [name, setName] = useState(''), [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  const profile = useQuery({ queryKey: ['customer-profile'], queryFn: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw new Error('Sign in again.');
    const result = await supabase.from('profiles').select('full_name').eq('user_id', data.user.id).single();
    if (result.error) throw result.error;
    return { id: data.user.id, email: data.user.email, name: result.data.full_name };
  }});
  useEffect(() => { if (profile.data) setName(profile.data.name); }, [profile.data]);
  async function save(e: React.FormEvent) {
    e.preventDefault(); if (!profile.data) return;
    setBusy(true); setMessage('');
    try {
      const { error } = await supabase.from('profiles').update({ full_name: name.trim(), updated_at: new Date().toISOString() }).eq('user_id', profile.data.id).select('full_name').single();
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ['customer-profile'] }); setMessage('Profile saved.');
    } catch { setMessage('Could not save your profile. Try again.'); } finally { setBusy(false); }
  }
  return <section className="space-y-3"><h2 className="font-semibold">Customer profile</h2>{profile.error ? <p role="alert">Profile unavailable.</p> : <form onSubmit={save} className="max-w-md space-y-3"><p className="break-all text-sm text-muted-foreground">{profile.data?.email}</p><Label htmlFor="profile-name">Full name</Label><Input id="profile-name" value={name} maxLength={100} onChange={e => setName(e.target.value)} disabled={!profile.data} autoComplete="name" /><Button disabled={busy || !profile.data}>{busy ? 'Saving…' : 'Save profile'}</Button>{message && <p role="status" className="text-sm">{message}</p>}</form>}</section>;
}