self.addEventListener("install", (e) => {
    e.waitUntil(
      caches.open("nbanima-cache-v1").then((cache) => {
        return cache.addAll(["/", "/it/dashboard", "/manifest.json"]);
      })
    );
  });
  
  self.addEventListener("fetch", (e) => {
    e.respondWith(
      caches.match(e.request).then((response) => {
        return response || fetch(e.request);
      })
    );
  });