import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { DEFAULT_CONFIG } from "@/lib/iwmWindowStrategy";

/** Read-only broker verification; never submits an order or enables automation. */
export const verifyIwmConnection = createServerFn({method:"POST"})
  .middleware([requireSupabaseAuth])
  .handler(async({context})=> {
    const {iwmAlpaca} = await import("@/lib/server/iwm-alpaca.server");
    const {supabaseAdmin} = await import("@/integrations/supabase/client.server");
    const api=await iwmAlpaca(supabaseAdmin,context.userId);
    return api.verify(DEFAULT_CONFIG,"iex","indicative");
  });