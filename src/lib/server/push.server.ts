import {strategyLabel} from '@/lib/strategy-platform';
export async function dispatchPush(db:any){
 const key=process.env['FIREBASE_MESSAGING_API_KEY'],auth=process.env['LOVABLE_API_KEY'];
 if(!key||!auth)return {configured:false,sent:0};
 const lease=crypto.randomUUID();const jobs=await db.rpc('claim_push_deliveries',{p_token:lease});if(jobs.error)throw new Error('Could not claim notifications');let sent=0;
 for(const job of jobs.data??[]){
  const [device,alert]=await Promise.all([db.from('push_devices').select('token,user_id').eq('id',job.device_id).maybeSingle(),db.from('strategy_alerts').select('user_id,symbol,strategy_id,side,reason,created_at').eq('id',job.alert_id).maybeSingle()]);
  const a=alert.data,d=device.data;
  if(!a||!d||a.user_id!==d.user_id||Date.now()-Date.parse(a.created_at)>15*60000){await db.from('push_deliveries').update({status:'failed',error_code:'expired'}).eq('id',job.id).eq('lease_token',lease);continue;}
  const tier=await db.rpc('plan_tier',{_user_id:a.user_id});if(tier.error||!['alerts','bots'].includes(tier.data)){await db.from('push_deliveries').update({status:'failed',error_code:'no_access'}).eq('id',job.id).eq('lease_token',lease);continue;}
  try{
   const r=await fetch('https://connector-gateway.lovable.dev/firebase_messaging/v1/projects/_/messages:send',{method:'POST',headers:{Authorization:`Bearer ${auth}`,'X-Connection-Api-Key':key,'Content-Type':'application/json'},body:JSON.stringify({message:{token:d.token,notification:{title:`${strategyLabel(a.strategy_id)} · ${a.symbol}`,body:`${a.side==='long'?'CALL':'PUT'} direction · ${a.reason}`},data:{path:'/signals'},webpush:{headers:{TTL:'300'},notification:{tag:`strategy-${job.alert_id}`,icon:'/icons/icon-192.png'},fcm_options:{link:'https://thesignalspot.com/signals'}}}})});
   if(r.ok){const done=await db.from('push_deliveries').update({status:'sent',sent_at:new Date().toISOString(),error_code:null}).eq('id',job.id).eq('lease_token',lease);if(done.error)throw new Error('Checkpoint failed');sent++;continue;}
   const detail=await r.json().catch(()=>({}));const stale=(r.status===404&&JSON.stringify(detail).includes('UNREGISTERED'))||r.status===400&&JSON.stringify(detail).includes('INVALID_ARGUMENT');
   if(stale){await db.from('push_devices').delete().eq('id',job.device_id);continue;}
   const retry=r.status===429||r.status>=500;
   const seconds=Math.max(Number(r.headers.get('Retry-After'))||0,Math.min(900,30*2**job.attempts));
   await db.from('push_deliveries').update({status:retry&&job.attempts<5?'pending':'failed',available_at:new Date(Date.now()+seconds*1000).toISOString(),error_code:`http_${r.status}`}).eq('id',job.id).eq('lease_token',lease);
  }catch{await db.from('push_deliveries').update({status:job.attempts<5?'pending':'failed',available_at:new Date(Date.now()+60000).toISOString(),error_code:'network_or_checkpoint'}).eq('id',job.id).eq('lease_token',lease);}
 }
 return {configured:true,sent};
}
