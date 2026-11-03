const V='akt-v2';
const LOCAL=['./','index.html','css/style.css','js/app.js','manifest.json','icons/icon-192.png','icons/icon-512.png'];
const CDN=['https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/sql-wasm.js','https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/sql-wasm.wasm','https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js','https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(V).then(c=>Promise.all([c.addAll(LOCAL),...CDN.map(u=>c.add(u).catch(()=>{}))])).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!=V).map(x=>caches.delete(x)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{if(e.request.method!='GET')return;
e.respondWith(caches.match(e.request,{ignoreSearch:true}).then(r=>r||fetch(e.request).then(res=>{const u=new URL(e.request.url);if(res.ok&&(u.origin==location.origin||u.hostname=='cdnjs.cloudflare.com')){const cp=res.clone();caches.open(V).then(c=>c.put(e.request,cp))}return res}).catch(()=>e.request.mode=='navigate'?caches.match('index.html'):undefined)))});
