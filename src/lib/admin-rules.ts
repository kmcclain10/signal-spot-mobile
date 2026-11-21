export function requireAdminRole(allowed: boolean) {
  if (!allowed) throw new Error('Administrator access required');
}
export function supportNoteBody(value: unknown) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 4000) throw new Error('Enter a note between 1 and 4000 characters');
  return value.trim();
}
