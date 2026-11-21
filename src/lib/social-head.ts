import type { AnyRoute } from '@tanstack/react-router';
import { PUBLIC_SITE } from './public-content';

export const SHARE_IMAGE = `${PUBLIC_SITE}/icons/og-image.png`;
const normalizedRoutes = new WeakSet<AnyRoute>();

// Emit raw text; React performs the one required HTML escape. Explicit Twitter
// tags prevent the hosting fallback from copying already-escaped OG content.
export function normalizeSocialHeads(routes: AnyRoute[]) {
  for (const route of routes) {
    if (route.isRoot || route.children?.length || normalizedRoutes.has(route)) continue;
    const original = route.options.head;
    if (!original) continue;
    route.update({ staticData: route.options.staticData ?? { sitemap: false }, head: async (context) => {
      const head = await original(context);
      const meta = head.meta ?? [];
      const title = meta.find(tag => tag && 'property' in tag && tag.property === 'og:title');
      const description = meta.find(tag => tag && 'property' in tag && tag.property === 'og:description');
      return { ...head, meta: [
        ...meta.filter(tag => !tag || !(
          ('name' in tag && ['twitter:title', 'twitter:description', 'twitter:image'].includes(tag.name ?? '')) ||
          ('property' in tag && tag.property === 'og:image')
        )),
        ...(title && 'content' in title ? [{ name: 'twitter:title', content: title.content }] : []),
        ...(description && 'content' in description ? [{ name: 'twitter:description', content: description.content }] : []),
        { property: 'og:image', content: SHARE_IMAGE },
        { name: 'twitter:image', content: SHARE_IMAGE },
      ] };
    } });
    normalizedRoutes.add(route);
  }
}