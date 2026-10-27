import { supabase } from '@/integrations/supabase/client';

export function magicLinkOptions(origin: string, creating: boolean, name: string) {
  return { emailRedirectTo: origin, shouldCreateUser: creating, ...(creating ? { data: { full_name: name.trim() } } : {}) };
}
export function passwordUpdate(password: string, confirmation: string, current?: string) {
  if (password.length < 8) throw new Error('Use at least 8 characters.');
  if (password !== confirmation) throw new Error('Passwords do not match.');
  return current === undefined ? { password } : { password, current_password: current };
}
export async function sendPasswordSetup(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
  if (error) throw error;
}