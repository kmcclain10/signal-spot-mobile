import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Read-only bot control-center data: settings, state, run history and errors for the signed-in owner. */
export const getBotsOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = context.supabase;
    const [settings, state, runs, errors] = await Promise.all([
      db.from("iwm_strategy_settings").select("*").eq("user_id", context.userId).maybeSingle(),
      db.from("iwm_strategy_state").select("*").eq("user_id", context.userId).maybeSingle(),
      db.from("bot_runs").select("ok,duration_ms,started_at,finished_at,error").eq("user_id", context.userId).order("started_at", { ascending: false }).limit(50),
      db.from("bot_errors").select("created_at,where,message").eq("user_id", context.userId).order("created_at", { ascending: false }).limit(20),
    ]);
    if (settings.error || state.error || runs.error || errors.error) throw new Error("Could not read bot status");
    return { settings: settings.data, state: state.data, runs: runs.data ?? [], errors: errors.data ?? [] };
  });
