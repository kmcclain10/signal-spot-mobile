import { queryOptions, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getStrategyPlatform, getRealPerformance } from '@/lib/strategy-platform.functions';

export const strategyPlatformOptions = queryOptions({queryKey:['strategy-platform'],queryFn:()=>getStrategyPlatform(),staleTime:10000,refetchInterval:15000});
export const realPerformanceOptions = queryOptions({queryKey:['real-performance'],queryFn:()=>getRealPerformance(),staleTime:30000,refetchInterval:60000});
export function useStrategyRealtime(userId:string) {
  const qc=useQueryClient();
  useEffect(()=>{
    const channel=supabase.channel(`real-strategies-${userId}`);
    for(const table of ['strategy_alerts','iwm_signals','iwm_trades','iwm_strategy_state','pulse_bot_events','pulse_bot_states','pulse_bot_configs']) channel.on('postgres_changes',{event:'*',schema:'public',table,filter:`user_id=eq.${userId}`},()=>{
      void qc.invalidateQueries({queryKey:['strategy-platform']});void qc.invalidateQueries({queryKey:['real-performance']});
    });
    channel.subscribe();return ()=>{void supabase.removeChannel(channel);};
  },[userId,qc]);
}