export const PUBLIC_SITE = 'https://thesignalspot.com';
export const SUPPORT_EMAIL = 'support@thesignalspot.com';
export const PUBLIC_DESCRIPTION = 'Rule-based options alerts on liquid US markets, with optional published-rule automation in an account you connect. Educational information, not personalized investment advice.';
// Authoritative editorial dates: update only when each page's substantive content changes.
export const PUBLIC_UPDATED: Record<string, string> = {
  '/welcome': '2026-11-20', '/strategies': '2026-11-20', '/terms': '2026-11-20',
  '/privacy': '2026-11-20', '/risk': '2026-11-20', '/contact': '2026-11-20',
};
export function publicHead(title: string, description: string, path: string) {
  const url = `${PUBLIC_SITE}${path}`;
  return { meta: [{ title: `${title} — Pulse Signals` }, { name: 'description', content: description },
    { property: 'og:title', content: `${title} — Pulse Signals` }, { property: 'og:description', content: description },
    { property: 'og:type', content: 'website' }, { property: 'og:url', content: url },
    { name: 'twitter:card', content: 'summary' }, { name: 'twitter:url', content: url }],
    links: [{ rel: 'canonical', href: url }] };
}