import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

export const Route = createFileRoute("/api/public/jobs/scan")({
  staticData: { sitemap: false },
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authFailure = await authenticateCronRequest(request);
        if (authFailure) return authFailure;
        const { runStrategyAlerts } = await import('@/lib/server/strategy-alerts.server');
        const result = await runStrategyAlerts();
        const { dispatchPush } = await import('@/lib/server/push.server');
        const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
        let push;
        try { push = await dispatchPush(supabaseAdmin); } catch { push = { configured: false, error: 'Notification delivery unavailable' }; }
        return Response.json({ success: result.errors === 0, ...result, push });
      },
    },
  },
});
