import {it,expect} from 'vitest';
import {canSendPush} from '@/lib/push-rules';
it('never sends another customer alert to a device',()=>expect(canSendPush('alice','bob','bots')).toBe(false));
it('allows Alerts subscribers to receive their own push',()=>expect(canSendPush('alice','alice','alerts')).toBe(true));
it('rejects devices without subscriber access',()=>expect(canSendPush('alice','alice',null)).toBe(false));
