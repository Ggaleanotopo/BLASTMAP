// BlastMap 0.3: cache solo de código; archivo oficial siempre en red.
const CACHE='blastmap-v040';
const FILES=['./','./index.html','./styles.css','./geo.js','./dxf.js','./vector.js','./app.js','./manifest.webmanifest','./assets/icon.svg','./assets/icon-192.png','./assets/icon-512.png'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  const req=event.request,url=new URL(req.url);
  if(req.method!=='GET'||url.origin!==self.location.origin||url.pathname.includes('/.netlify/')||url.pathname.startsWith('/api/')||url.pathname.endsWith('/voladuras-oficiales.json')||url.pathname.endsWith('/voladuras-archivos.json')||url.pathname.includes('/voladuras/'))return;
  event.respondWith(fetch(req).then(resp=>{if(resp.ok&&resp.type==='basic'){let copy=resp.clone();caches.open(CACHE).then(c=>c.put(req,copy));}return resp;}).catch(()=>caches.match(req)));
});
