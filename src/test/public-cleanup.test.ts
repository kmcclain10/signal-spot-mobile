import { describe, expect, it } from 'vitest';
import { getRouter } from '@/router';
import { Route as Welcome } from '@/routes/welcome';
import { Route as Pricing } from '@/routes/pricing';
import { Route as About } from '@/routes/about';
import { sitemapStaticPaths } from '@/lib/sitemap';

describe('Public legacy URLs', () => {
  it.each([
    ['welcome', Welcome, undefined],
    ['pricing', Pricing, 'pricing'],
    ['about', About, undefined],
  ] as const)('permanently redirects %s to the homepage', (_name, route, hash) => {
    getRouter();
    const beforeLoad = route.options.beforeLoad;
    if (!beforeLoad) throw new Error('Missing redirect');
    try {
      Reflect.apply(beforeLoad, undefined, [{}]);
      throw new Error('Expected a redirect');
    } catch (error) {
      expect(error).toMatchObject({ options: { to: '/', statusCode: 301, ...(hash ? { hash } : {}) } });
    }
  });

  it('includes only the canonical homepage in the sitemap', () => {
    const paths = sitemapStaticPaths(getRouter());
    expect(paths).toContain('/');
    expect(paths).not.toContain('/welcome');
    expect(paths).not.toContain('/pricing');
    expect(paths).not.toContain('/about');
  });
});