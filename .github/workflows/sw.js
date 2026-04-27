// sw.js - Service Worker pour PWA depenses.wisdak.net

const CACHE_NAME = 'gestion-depenses-v19';
const DYNAMIC_CACHE = 'gestion-depenses-dynamic-v19';

// Fichiers statiques à mettre en cache
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/offline.html',
  '/css/style.css',
  '/js/database.js',
  '/js/sync.js',
  '/js/app.js',
  '/manifest.json',
  '/icons/image.png',
  'css/font/font-awesome.css',
  'https://fonts.googleapis.com/icon?family=Material+Icons',
  'https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap',
  'https://fonts.gstatic.com/s/materialicons/v143/flUhRq6tzZclQEJ-Vdg-IuiaDsNc.woff2',
  'https://fonts.gstatic.com/s/poppins/v20/pxiEyp8kv8JHgFVrJJfecg.woff2'
];

// Installation du Service Worker
self.addEventListener('install', (event) => {
  console.log('SW: Installation...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
      .catch(err => console.error('SW: Erreur installation', err))
  );
});

// Activation et nettoyage des anciens caches
self.addEventListener('activate', (event) => {
  console.log('SW: Activation...');
  event.waitUntil(
    caches.keys().then((keys) => 
      Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME && key !== DYNAMIC_CACHE) {
            console.log('SW: Suppression ancien cache', key);
            return caches.delete(key);
          }
        })
      )
    ).then(() => self.clients.claim())
  );
});

// Gestion des requêtes fetch
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Ignorer certaines requêtes externes (Google APIs)
  if (url.origin !== location.origin &&
      (url.href.includes('googleapis.com') || url.href.includes('accounts.google.com') || url.href.includes('gstatic.com'))) {
    return;
  }

  // Pages HTML - Network First avec fallback cache
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(resp => {
          return caches.open(DYNAMIC_CACHE).then(cache => {
            cache.put(event.request, resp.clone());
            return resp;
          });
        })
        .catch(() => caches.match('/index.html', { ignoreSearch: true }))
    );
    return;
  }

  // Assets statiques - Cache First
  if (event.request.url.match(/\.(css|js|png|jpg|jpeg|svg|woff|woff2)$/)) {
    event.respondWith(
      caches.match(event.request).then(cacheResp => {
        return cacheResp || fetch(event.request).then(networkResp => {
          return caches.open(DYNAMIC_CACHE).then(cache => {
            cache.put(event.request, networkResp.clone());
            return networkResp;
          });
        });
      })
    );
    return;
  }

  // Tout le reste - Network First
  event.respondWith(
    fetch(event.request)
      .then(resp => caches.open(DYNAMIC_CACHE).then(cache => { cache.put(event.request, resp.clone()); return resp; }))
      .catch(() => caches.match(event.request))
  );
});

// Messages depuis l'application
self.addEventListener('message', (event) => {
  if (!event.data) return;

  if (event.data.type === 'SKIP_WAITING') self.skipWaiting();
  if (event.data.type === 'CLEAR_CACHE') caches.delete(DYNAMIC_CACHE).then(() => console.log('SW: Cache dynamique nettoyé'));
  if (event.data.type === 'BACKGROUND_SYNC') console.log('SW: Message BACKGROUND_SYNC reçu');
});

// Synchronisation en arrière-plan
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-expenses') {
    console.log('SW: Background sync - synchronisation dépenses');
    event.waitUntil(syncExpenses());
  }
});

async function syncExpenses() {
  try {
    const clientsList = await self.clients.matchAll();
    clientsList.forEach(client => {
      client.postMessage({ type: 'BACKGROUND_SYNC', action: 'sync' });
    });                                                                                                                                                                 
  } catch (err) {
    console.error('SW: Erreur background sync', err);
  }
}

// Notifications push
self.addEventListener('push', (event) => {
  const data = event.data.json();
  const options = {
    body: data.body,
    icon: '/icons/image.png',
    badge: '/icons/image.png',
    vibrate: [200, 100, 200],
    data: { url: data.url || '/' },
    actions: [
      { action: 'open', title: 'Ouvrir' },
      { action: 'close', title: 'Fermer' }
    ]
  };
  event.waitUntil(self.registration.showNotification(data.title, options));
});

// Clic sur notification
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'open') {
    event.waitUntil(clients.openWindow(event.notification.data.url));
  }
});