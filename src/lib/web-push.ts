export async function enableWebPush():Promise<{status:string;token?:string}> {
 if(typeof window==='undefined')return {status:'unsupported'};
 if(window.top!==window.self)return {status:'open-in-new-tab'};
 const appId=import.meta.env.VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_APP_ID;
 const vapidKey=import.meta.env.VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_VAPID_KEY;
 const config={apiKey:import.meta.env.VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_WEB_API_KEY,projectId:import.meta.env.VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_PROJECT_ID,appId,messagingSenderId:appId?.split(':')[1]??''};
 if(!config.apiKey||!config.projectId||!appId||!vapidKey||!config.messagingSenderId)return {status:'not-configured'};
 const {isSupported,getMessaging,getToken}=await import('firebase/messaging');
 if(!('Notification' in window)||!await isSupported())return {status:'unsupported'};
 const permission=Notification.permission==='granted'?'granted':await Notification.requestPermission();
 if(permission!=='granted')return {status:'denied'};
 const {initializeApp,getApps}=await import('firebase/app');
 const app=getApps().find(a=>a.name==='signalspot-push')??initializeApp(config,'signalspot-push');
 const registration=await navigator.serviceWorker.register('/firebase-messaging-sw.js?'+new URLSearchParams(config).toString());
 const token=await getToken(getMessaging(app),{vapidKey,serviceWorkerRegistration:registration});
 return token?{status:'registered',token}:{status:'denied'};
}
