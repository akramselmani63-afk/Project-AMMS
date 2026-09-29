const CACHE = 'amms-shell-v2';
const FILES = [
  './', './index.html', './styles.css', './manifest.webmanifest',
  './src/app.js', './src/commands.js', './src/data.js', './src/workflow.js', './src/storage.js', './src/photos.js', './src/source-assets.js',
  './assets/agridiam-logo.png', './assets/amms-logo-monitoring.png', './assets/amms-app-icon-green-a.png',
  './assets/amms-pwa-192.png', './assets/amms-pwa-512.png'
];
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES)).then(() => self.skipWaiting())));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(fetch(event.request).then(response => {
    if (response.ok) caches.open(CACHE).then(cache => cache.put(event.request, response.clone()));
    return response;
  }).catch(async () => await caches.match(event.request) || (event.request.mode === 'navigate' ? caches.match('./index.html') : Response.error())));
});
