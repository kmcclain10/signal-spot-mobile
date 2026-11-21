importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');
firebase.initializeApp(Object.fromEntries(new URL(self.location).searchParams));
firebase.messaging();
self.addEventListener('notificationclick', event => {
 event.notification.close();
 event.waitUntil(clients.openWindow(new URL('/signals',self.location.origin).href));
});
