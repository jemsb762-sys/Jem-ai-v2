const CACHE="jem-ai-v2";
self.addEventListener("install",event=>event.waitUntil(caches.open(CACHE).then(c=>c.addAll(["/","/index.html","/style.css","/app.js","/manifest.json"]))));
self.addEventListener("activate",event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener("fetch",event=>{
 const url=new URL(event.request.url);
 if(event.request.method!=="GET"||url.pathname.startsWith("/api/"))return;
 event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).then(response=>{
  if(response.ok){const copy=response.clone();caches.open(CACHE).then(c=>c.put(event.request,copy));}return response;
 }).catch(()=>caches.match("/index.html"))));
});
