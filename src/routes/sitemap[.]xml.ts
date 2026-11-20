import { createFileRoute } from "@tanstack/react-router";
import { getRouterInstance } from "@tanstack/react-start";
import { PLAYBOOK } from "@/lib/strategy-platform";
import { strategySlug } from "@/lib/strategy-seo";
import { sitemapStaticPaths, sitemapXML, type SitemapEntry } from "@/lib/sitemap";
import { PUBLIC_UPDATED } from '@/lib/public-content';

const BASE_URL = "https://thesignalspot.com";

export const Route = createFileRoute("/sitemap.xml")({
  staticData: { sitemap: false },
  server: {
    handlers: {
      GET: async () => {
        if (!BASE_URL) {
          return new Response("Sitemap domain not configured", {
            status: 503,
            headers: { "Cache-Control": "no-store" },
          });
        }
        const router = await getRouterInstance();
        const entries: SitemapEntry[] = sitemapStaticPaths(router).map((path) => ({ path, ...(PUBLIC_UPDATED[path.replace(/\/$/, '')] ? { lastmod: PUBLIC_UPDATED[path.replace(/\/$/, '')] } : {}) }));
        // All strategy pages received substantive rule-copy corrections in this editorial revision.
        for (const s of PLAYBOOK) entries.push({ path: `/strategies/${strategySlug(s.id)}`, lastmod: '2026-11-20' });
        if (entries.length === 0) {
          return new Response(
            'No pages are included in this sitemap. Check route decisions and ancestor exclusions. Setting "exclude-subtree" on the root excludes the entire site.',
            { status: 404, headers: { "Cache-Control": "no-store" } },
          );
        }
        return new Response(sitemapXML(BASE_URL, entries), {
          headers: { "Content-Type": "application/xml", "Cache-Control": "public, max-age=3600" },
        });
      },
    },
  },
});
