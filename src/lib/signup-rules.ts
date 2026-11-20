export const NEW_PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;
export function validateNewPassword(password: string) {
  if (password.length < NEW_PASSWORD_MIN) throw new Error('Use at least 8 characters.');
  if (password.length > PASSWORD_MAX) throw new Error('Use no more than 128 characters.');
}
export function validateSignup(password: string, accepted: boolean) {
  if (!accepted) throw new Error('Agree to the Terms, Privacy Policy and Risk disclosure before creating an account.');
  validateNewPassword(password);
}