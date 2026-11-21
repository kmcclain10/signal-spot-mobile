import {describe,it,expect} from 'vitest';
import {requireAdminRole,supportNoteBody} from '@/lib/admin-rules';
describe('customer admin permissions',()=>{it('rejects a customer without an admin role',()=>expect(()=>requireAdminRole(false)).toThrow('Administrator access required'));it('allows a verified admin',()=>expect(()=>requireAdminRole(true)).not.toThrow());it('rejects empty staff notes',()=>expect(()=>supportNoteBody(' ')).toThrow());});
