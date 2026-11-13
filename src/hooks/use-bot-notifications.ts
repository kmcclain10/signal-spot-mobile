import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from '@tanstack/react-query';
import { getStrategyPlatform } from '@/lib/strategy-platform.functions';
import { strategyLabel } from '@/lib/strategy-platform';
import { useRef } from 'react';

const KEY = "bot-notifications";
export const notificationsSupported = () => typeof window !== "undefined" && "Notification" in window;

/** Browser notifications for new IWM bot trades. Opt-in; stored on this device only. */
export function useBotNotifications(userId: string | undefined, listen = false) {
  const [enabled, setEnabled] = useState(false);
  const seen = useRef<Set<string> | null>(null);
  const signals = useQuery({queryKey:['strategy-notifications',userId],queryFn:()=>getStrategyPlatform(),enabled:listen&&enabled&&!!userId,refetchInterval:15000});
  useEffect(()=>{
    if(!listen || !signals.data || !enabled || !notificationsSupported() || Notification.permission!=='granted') return;
    const rows=signals.data.signals;
    if(seen.current===null){seen.current=new Set(rows.map(s=>s.id));return;}
    for(const s of rows){if(seen.current.has(s.id)) continue;seen.current.add(s.id);
      if(Date.now()-Date.parse(s.at)>120000) continue;
      new Notification(`${strategyLabel(s.strategy)}: ${s.symbol}`,{body:`${s.side==='long'?'Bullish':'Bearish'} · ${s.reason}`,tag:`strategy-${s.id}`,icon:'/icons/icon-192.png'});
    }
  },[signals.data,enabled,listen]);
  useEffect(() => { const sync=()=>{try {setEnabled(localStorage.getItem(KEY)==="1");}catch{setEnabled(false);}}; sync();window.addEventListener("pulse-notifications-change",sync);return ()=>window.removeEventListener("pulse-notifications-change",sync);}, []);

  async function toggle(next: boolean) {
    if (next && notificationsSupported() && Notification.permission === "default") {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") return false;
    }
    if (next && (!notificationsSupported() || Notification.permission !== "granted")) return false;
    localStorage.setItem(KEY, next ? "1" : "0");
    setEnabled(next);
    window.dispatchEvent(new Event("pulse-notifications-change"));
    return true;
  }

  useEffect(() => {
    if (!listen || !enabled || !userId || !notificationsSupported() || Notification.permission !== "granted") return;
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
  }, [enabled, userId, listen]);

  return { enabled, toggle, supported: notificationsSupported() };
}
