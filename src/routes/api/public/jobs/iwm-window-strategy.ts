import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";
import { iwmScheduleTime } from "@/lib/iwm-engine-rules";

export const Route=createFileRoute("/api/public/jobs/iwm-window-strategy")({
  server:{handlers:{POST:async({request})=> {
    const authFailure=await authenticateCronRequest(request);
    if(authFailure) return authFailure;
    if(!iwmScheduleTime(new Date())) return Response.json({skipped:"outside weekday market monitoring hours"});
    const {runIwmScheduled}=await import("@/lib/server/iwm-engine.server");
    return Response.json(await runIwmScheduled());
  }}},
});