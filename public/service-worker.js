self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map((name) => caches.delete(name)));
    })(),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      await caches.keys().then((names) =>
        Promise.all(names.map((name) => caches.delete(name))),
      );
      await self.registration.unregister();
      const clients = await self.clients.matchAll({
        includeUncontrolled: true,
        type: 'window',
      });
      for (const client of clients) {
        client.navigate(client.url);
      }
    })(),
  );
});

self.addEventListener('fetch', () => {});
