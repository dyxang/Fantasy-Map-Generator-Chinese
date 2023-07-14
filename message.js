"use strict";

// version and caching control
 // generator version, update each time

{


  async function clearCache() {
    const cacheNames = await caches.keys();
    Promise.all(cacheNames.map(cacheName => caches.delete(cacheName)));
  }
}
