import { describe, expect, it, vi } from 'vitest';
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
import { passwordUpdate } from '@/lib/auth-actions';

describe('customer access rules', () => {
  it('rejects new passwords shorter than 8 characters',()=>expect(() => passwordUpdate('abcdefg','abcdefg')).toThrow('at least 8'));
  it('accepts an 8-character new password',()=>expect(passwordUpdate('abcdefgh','abcdefgh')).toEqual({password:'abcdefgh'}));
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