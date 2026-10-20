// public/js/sw.js
const CACHE_NAME = 'sodie-v3.5';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Manejo de peticiones de red
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
});
