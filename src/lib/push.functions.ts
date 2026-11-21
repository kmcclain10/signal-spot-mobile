import {createServerFn} from '@tanstack/react-start';
import {requireSupabaseAuth} from '@/integrations/supabase/auth-middleware';
export const pushStatus=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).handler(async({context})=>{
 const r=await context.supabase.from('push_devices').select('id,label').eq('user_id',context.userId);if(r.error)throw new Error('Could not read notification devices');
 return {configured:!!process.env['FIREBASE_MESSAGING_API_KEY']&&!!process.env['LOVABLE_API_KEY'],devices:r.data};
});
export const registerPush=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((d:{token:string})=>{if(typeof d.token!=='string'||d.token.length<20||d.token.length>4096)throw new Error('Invalid notification registration');return d;}).handler(async({context,data})=>{
 const r=await context.supabase.from('push_devices').upsert({user_id:context.userId,token:data.token,label:'Browser notifications',updated_at:new Date().toISOString()},{onConflict:'token'});if(r.error)throw new Error('Could not register this device');return true;
});
export const removePush=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((d:{id:string})=>d).handler(async({context,data})=>{const r=await context.supabase.from('push_devices').delete().eq('id',data.id).eq('user_id',context.userId);if(r.error)throw new Error('Could not remove device');return true;});
