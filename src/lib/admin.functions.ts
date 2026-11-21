import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { requireAdminRole, supportNoteBody } from './admin-rules';
export const getAdminAccess = createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).handler(async({context})=>{
 const r=await context.supabase.rpc('has_role',{_user_id:context.userId,_role:'admin'});
 if(r.error) throw new Error('Could not verify staff access');
 return r.data===true;
});
export const getCustomers = createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((data:{page:number})=>({page:Math.max(1,Math.floor(data.page||1))})).handler(async({context,data})=>{
 const role=await context.supabase.rpc('has_role',{_user_id:context.userId,_role:'admin'});requireAdminRole(!role.error&&role.data===true);
 const {supabaseAdmin:db}=await import('@/integrations/supabase/client.server');
 const users=await db.auth.admin.listUsers({page:data.page,perPage:25});if(users.error) throw new Error('Could not load customers');
 const ids=users.data.users.map(u=>u.id);
 const [profiles,subs,grants]=await Promise.all([db.from('profiles').select('user_id,full_name').in('user_id',ids),db.from('subscriptions').select('user_id,status,price_id,environment,current_period_end,cancel_at_period_end').in('user_id',ids).order('created_at',{ascending:false}),db.from('plan_grants').select('user_id,tier').in('user_id',ids)]);
 if(profiles.error||subs.error||grants.error) throw new Error('Could not load customer billing');
 return {customers:users.data.users.map(u=>({id:u.id,email:u.email??'',createdAt:u.created_at,confirmed:!!u.email_confirmed_at,name:profiles.data?.find(p=>p.user_id===u.id)?.full_name??'',subscriptions:subs.data?.filter(s=>s.user_id===u.id)??[],grant:grants.data?.find(g=>g.user_id===u.id)?.tier??null})),hasMore:users.data.users.length===25};
});
export const getSupportNotes=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((d:{customerId:string})=>d).handler(async({context,data})=>{
 const role=await context.supabase.rpc('has_role',{_user_id:context.userId,_role:'admin'});requireAdminRole(!role.error&&role.data===true);
 const r=await context.supabase.from('customer_support_notes').select('id,body,created_at').eq('customer_id',data.customerId).order('created_at',{ascending:false}).limit(100);if(r.error)throw new Error('Could not read support notes');return r.data;
});
export const addSupportNote=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((d:{customerId:string;body:string})=>({...d,body:supportNoteBody(d.body)})).handler(async({context,data})=>{
 const role=await context.supabase.rpc('has_role',{_user_id:context.userId,_role:'admin'});requireAdminRole(!role.error&&role.data===true);
 const r=await context.supabase.from('customer_support_notes').insert({customer_id:data.customerId,author_id:context.userId,body:data.body});if(r.error)throw new Error('Could not save support note');return true;
});
