import { supabase } from '@/integrations/supabase/client';
import { validateNewPassword } from '@/lib/signup-rules';

export function passwordUpdate(password: string, confirmation: string, current?: string) {
  validateNewPassword(password);
  if (password !== confirmation) throw new Error('Passwords do not match.');
  return current === undefined ? { password } : { password, current_password: current };
}
export async function sendPasswordSetup(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
  if (error) throw error;
}