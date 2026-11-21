import {useState} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {Bell,Trash2} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {pushStatus,registerPush,removePush} from '@/lib/push.functions';
import {enableWebPush} from '@/lib/web-push';
const messages:Record<string,string>={'open-in-new-tab':'Open the app in its own tab or use the published website to enable notifications.','not-configured':'Notifications are awaiting setup. The owner must complete the Firebase connection with Include web push selected.','unsupported':'This browser does not support push. On iPhone, use Safari and add the app to your Home Screen first.','denied':'Notifications are blocked. Allow them in your browser’s site settings.','registered':'This device is registered for background strategy alerts.'};
export function PushNotifications(){
 const q=useQuery({queryKey:['push-status'],queryFn:()=>pushStatus()}),qc=useQueryClient();const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
 return <section className="space-y-3 border-t pt-5"><h2 className="flex items-center gap-2 font-semibold"><Bell className="size-4 text-primary"/>Background strategy alerts</h2>
 <p className="text-sm text-muted-foreground">{q.data?.configured?'Opt-in notifications can arrive while the app is closed on supported devices. Delivery may be delayed or missed.':'Background delivery is awaiting Firebase setup; member-feed alerts are unchanged.'}</p>
 <Button variant="outline" disabled={busy} onClick={async()=>{setBusy(true);try{const r=await enableWebPush();if(r.token){await registerPush({data:{token:r.token}});await qc.invalidateQueries({queryKey:['push-status']});}setMessage(messages[r.status]??'Could not enable notifications');}catch{setMessage('Could not enable notifications. Please try again.');}finally{setBusy(false);}}}>{busy?'Enabling…':'Enable on this device'}</Button>
 {message&&<p role="status" className="text-sm">{message}</p>}{q.error&&<p role="alert">Could not load notification devices.</p>}
 {q.data?.devices.map(d=><div key={d.id} className="flex items-center justify-between border-b py-2 text-sm"><span>{d.label}</span><Button variant="ghost" size="icon" title="Stop notifications for this device" aria-label="Stop notifications for this device" onClick={async()=>{try{await removePush({data:{id:d.id}});await q.refetch();}catch{setMessage('Could not remove device');}}}><Trash2/></Button></div>)}
 </section>;
}
