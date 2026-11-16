// public/js/sw.js
const CACHE_NAME = 'sodie-v4';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
});

// =========================================================================
// ESCUCHADOR DE NOTIFICACIONES PUSH (Radar SODIE)
// =========================================================================
self.addEventListener('push', function(event) {
  if (event.data) {
    try {
      const pushData = event.data.json();
      
      const opciones = {
        body: pushData.body,
        icon: pushData.icon || '/icono.jpg',
        badge: '/icono.jpg',
        vibrate: [200, 100, 200, 100, 200],
        data: pushData.data || {} // Contiene clientId, campaignId y/o url destino
      };

      event.waitUntil(
        self.registration.showNotification(pushData.title || 'SODIE Radar', opciones)
      );
    } catch (e) {
      console.error('Error procesando el payload de la Push:', e);
    }
  }
});

// =========================================================================
// REDIRECCIÓN INTELIGENTE AL HACER CLIC EN LA NOTIFICACIÓN
// =========================================================================
self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  const payload = event.notification.data || {};
  // Si el payload especifica url la usa; si el clientId es ADMIN va a /admin, sino al panel del cliente
  let targetPath = payload.url || ((payload.clientId === 'ADMIN' || !payload.clientId) ? '/admin' : '/client');

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      // 1. Si ya hay una pestaña abierta con el panel (/admin o /client), la enfocamos
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if ((client.url.includes('/admin') || client.url.includes('/client')) && 'focus' in client) {
          return client.focus();
        }
      }
      // 2. Si estaba cerrado, abre directamente la ruta correspondiente en la app
      if (clients.openWindow) {
        return clients.openWindow(targetPath);
      }
    })
  );
});
