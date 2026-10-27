import { describe, expect, it, vi } from 'vitest';
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
import { magicLinkOptions, passwordUpdate } from '@/lib/auth-actions';

describe('customer access rules', () => {
  it('magic signup creates a customer with their profile name', () => {
    expect(magicLinkOptions('https://app.example', true, ' Kevin ')).toEqual({ emailRedirectTo: 'https://app.example', shouldCreateUser: true, data: { full_name: 'Kevin' } });
  });
  it('magic login does not silently create a new customer', () => {
    expect(magicLinkOptions('https://app.example', false, '').shouldCreateUser).toBe(false);
  });
  it('recovery never requires a password the customer does not have', () => {
    expect(passwordUpdate('long-password', 'long-password')).toEqual({ password: 'long-password' });
  });
  it('signed-in password change supplies the current password', () => {
    expect(passwordUpdate('long-password', 'long-password', 'old-password')).toEqual({ password: 'long-password', current_password: 'old-password' });
  });
  it('rejects mismatched password confirmation', () => {
    expect(() => passwordUpdate('long-password', 'different')).toThrow('Passwords do not match');
  });
});