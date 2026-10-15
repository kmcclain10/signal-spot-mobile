import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

export const Route = createFileRoute("/api/public/jobs/scan")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authFailure = await authenticateCronRequest(request);
        if (authFailure) return authFailure;
        const { nyHour, phaseForNyHour, runScheduledScan } = await import("@/lib/server/scan.server");
        const now = new Date();
        const wd = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "short" }).format(now);
        const phase = phaseForNyHour(nyHour(now));
        if (!phase || wd === "Sat" || wd === "Sun") return Response.json({ skipped: true });
        const result = await runScheduledScan(phase);
        return Response.json({ success: true, users: result.users, phase });
      },
    },
  },
});
