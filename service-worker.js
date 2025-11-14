// service-worker.js – RESET COMPLET DU SERVICE WORKER

self.addEventListener('install', (event) => {
  // On prend la main immédiatement
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // On vide tous les caches existants et on désinstalle le SW
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
      await self.registration.unregister();
      console.log('[SW] Tous les caches supprimés et service worker désinstallé');
    })()
  );
});

// On ne fait rien sur les fetch : tout repasse en direct au serveur
self.addEventListener('fetch', () => {
  // Intentionnellement vide
});
