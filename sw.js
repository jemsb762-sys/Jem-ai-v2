// Jem AI service worker
// አሮጌ cache ያጸዳል፣ እና ምንም ጥያቄ (API ጨምሮ) አያግድም ወይም አይጠልፍም።

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    (async () => {
      // ሁሉንም አሮጌ cache ሰርዝ
      const keys = await caches.keys();
      await Promise.all(keys.map(key => caches.delete(key)));

      // ወዲያውኑ ገጹን ተቆጣጠር
      await self.clients.claim();
    })()
  );
});

// ሆን ተብሎ "fetch" handler የለም፤
// ሁሉም ጥያቄዎች በቀጥታ ወደ ኢንተርኔት ይሄዳሉ (/api/chat ጨምሮ)።
