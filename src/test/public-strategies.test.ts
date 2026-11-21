import { describe, expect, it } from 'vitest';
import { PLAYBOOK } from '@/lib/strategy-platform';
import { publicStrategy } from '@/lib/public-strategies';

describe('public strategy adapter', () => {
  it.each(PLAYBOOK.map(strategy => [strategy.id]))('resolves %s independently of other strategies', id => {
    const strategy = publicStrategy(id);
    expect(strategy).toBeDefined();
    expect(strategy?.rules.length).toBeGreaterThan(0);
    expect(strategy?.rules.join(' ')).not.toMatch(/undefined|NaN/);
  });
});