import { describe, expect, it } from 'vitest';
import { validateSignup } from '@/lib/signup-rules';
describe('new-account safeguards', () => {
  it('requires legal acknowledgment before account creation', () => {
    expect(() => validateSignup('abcdefgh', false)).toThrow('Agree to the Terms');
    expect(() => validateSignup('abcdefgh', true)).not.toThrow();
  });
  it('requires at least 8 characters for signup', () => {
    expect(() => validateSignup('abcdefg', true)).toThrow('at least 8');
    expect(() => validateSignup('abcdefgh', true)).not.toThrow();
  });
});