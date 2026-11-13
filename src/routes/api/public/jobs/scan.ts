import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

export const Route = createFileRoute("/api/public/jobs/scan")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authFailure = await authenticateCronRequest(request);
        if (authFailure) return authFailure;
        const { runStrategyAlerts } = await import('@/lib/server/strategy-alerts.server');
        const result = await runStrategyAlerts();
        return Response.json({ success: result.errors === 0, ...result });
      },
    },
  },
});
