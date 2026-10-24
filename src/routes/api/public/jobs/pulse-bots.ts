import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";
export const Route=createFileRoute("/api/public/jobs/pulse-bots")({server:{handlers:{POST:async({request})=>{
  const failure=await authenticateCronRequest(request);if(failure) return failure;
  const {runPulseScheduled}=await import("@/lib/server/pulse-engine.server");
  return Response.json(await runPulseScheduled());
}}}});