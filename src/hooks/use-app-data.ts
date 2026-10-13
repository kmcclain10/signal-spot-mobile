import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { providerProxy } from "@/lib/api.functions";
import { marketStatus, nyDate } from "@/lib/market-hours";

export function useSettings() {
  return useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const { data, error } = await supabase.from("settings").select("*").maybeSingle();
      if (error) throw error;
      if (data) return data;
      const { data: ins, error: e2 } = await supabase.from("settings").insert({ user_id: u.user!.id }).select("*").single();
      if (e2) throw e2;
      return ins;
    },
  });
}

export function useConnections() {
  return useQuery({
    queryKey: ["connections"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("connections")
        .select(
          "id,provider,label,environment,config,secret_hint,status,status_detail,last_tested_at,is_default_data,is_default_broker,created_at",
        )
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });
}

export function useBroker<T = any>(action: string, args: any[] = [], enabled = true) {
  const proxy = useServerFn(providerProxy);
  const conns = useConnections();
  const hasBroker = (conns.data ?? []).some((c) => c.is_default_broker);
  return useQuery({
    queryKey: ["broker", action, args],
    enabled: enabled && hasBroker,
    queryFn: async () => (await proxy({ data: { capability: "broker", action, args } })).result as T,
    refetchInterval: () => (marketStatus().phase === "open" ? 15000 : false),
    retry: false,
  });
}

export function useHasBroker() {
  const conns = useConnections();
  return { loading: conns.isLoading, hasBroker: (conns.data ?? []).some((c) => c.is_default_broker) };
}

export function useLatestBacktest() {
  return useQuery({
    queryKey: ["runs", "latest-backtest"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("engine_runs")
        .select("id,status,summary,started_at,finished_at")
        .eq("kind", "backtest")
        .order("finished_at", { ascending: false, nullsFirst: false })
        .limit(1);
      if (error) throw error;
      return data[0] ?? null;
    },
  });
}

/** Subscribes to realtime changes on a table and invalidates the given query keys. */
export function useRealtimeInvalidate(table: "signals" | "picks" | "engine_runs", keys: string[][]) {
  const qc = useQueryClient();
  useEffect(() => {
    const ch = supabase
      .channel(`rt-${table}`)
      .on("postgres_changes", { event: "*", schema: "public", table }, () => {
        keys.forEach((k) => qc.invalidateQueries({ queryKey: k }));
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table]);
}

export const todayNY = () => nyDate();
