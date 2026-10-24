import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const KEY = "bot-notifications";
export const notificationsSupported = () => typeof window !== "undefined" && "Notification" in window;

/** Browser notifications for new IWM bot trades. Opt-in; stored on this device only. */
export function useBotNotifications(userId: string | undefined) {
  const [enabled, setEnabled] = useState(() => (typeof window !== "undefined" ? localStorage.getItem(KEY) === "1" : false));

  async function toggle(next: boolean) {
    if (next && notificationsSupported() && Notification.permission === "default") {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") return false;
    }
    if (next && (!notificationsSupported() || Notification.permission !== "granted")) return false;
    localStorage.setItem(KEY, next ? "1" : "0");
    setEnabled(next);
    return true;
  }

  useEffect(() => {
    if (!enabled || !userId || !notificationsSupported() || Notification.permission !== "granted") return;
    const ch = supabase
      .channel(`notify-${userId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "iwm_trades", filter: `user_id=eq.${userId}` }, (row) => {
        const t = row.new as Record<string, any>;
        new Notification("IWM bot entered a trade", { body: `IWM $${t.strike} ${t.side} • ${t.contracts} contracts`, tag: `iwm-${t.id}` });
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "iwm_bank_events", filter: `user_id=eq.${userId}` }, (row) => {
        const b = row.new as Record<string, any>;
        new Notification("IWM bot banked profits", { body: `$${Number(b.amount_banked).toLocaleString()} banked • cycle ${b.new_cycle}`, tag: `bank-${b.id}` });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [enabled, userId]);

  return { enabled, toggle, supported: notificationsSupported() };
}
