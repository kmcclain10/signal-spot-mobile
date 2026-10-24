import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
export const getAccountSummary = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { data, error } = await context.supabase.from("connections").select("id,label,environment,status").eq("user_id", context.userId).eq("provider", "alpaca").eq("environment", "paper").limit(1);
  if (error) throw new Error("Could not read your account connection.");
  if (!data?.length) return { connected: false, lastFour: null, optionsLevel: null, status: null, error: null };
  try {
    const { iwmAlpaca } = await import("@/lib/server/iwm-alpaca.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const api = await iwmAlpaca(supabaseAdmin, context.userId, data[0].id);
    const a = await api.account();
    return { connected: true, lastFour: a.account_number ? String(a.account_number).slice(-4) : null, optionsLevel: Number(a.options_trading_level ?? 0), status: String(a.status ?? "Unknown"), error: null };
  } catch { return { connected: true, lastFour: null, optionsLevel: null, status: null, error: "Alpaca account details are temporarily unavailable." }; }
});