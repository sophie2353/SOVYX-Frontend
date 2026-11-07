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

// =========================================================================
// 🔔 ESCUCHADOR DE NOTIFICACIONES PUSH (Radar SODIE)
// =========================================================================
self.addEventListener('push', function(event) {
  if (event.data) {
    try {
      // Leemos el payload que mandamos desde el backend
      const pushData = event.data.json();
      
      const opciones = {
        body: pushData.body,
        icon: pushData.icon || '/assets/icon-sodie.png', // Ajusta la ruta de tu logo
        badge: '/icono.jpg', // Iconito pequeño para la barra de estado en Android
        vibrate: [200, 100, 200, 100, 200], // Vibración sci-fi 👺
        data: pushData.data // Aquí viene el clientId y campaignId
      };

      event.waitUntil(
        self.registration.showNotification(pushData.title, opciones)
      );
    } catch (e) {
      console.error('Error procesando el payload de la Push:', e);
    }
  }
});

// =========================================================================
// 🖱️ QUÉ PASA CUANDO HACES CLIC EN LA NOTIFICACIÓN
// =========================================================================
self.addEventListener('notificationclick', function(event) {
  event.notification.close(); // Cierra la tarjetita

  // Al hacer clic, te abre la pestaña del panel de Admin para que actives la campaña
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(windowClients => {
      // Si ya tienes el panel abierto, lo enfoca
      for (let i = 0; i < windowClients.length; i++) {
        let client = windowClients[i];
        if (client.url.includes('/admin') && 'focus' in client) {
          return client.focus();
        }
      }
      // Si estaba cerrado, lo abre en una pestaña nueva
      if (clients.openWindow) {
        return clients.openWindow('/admin'); 
      }
    })
  );
});
