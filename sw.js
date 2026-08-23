const CACHE = 'gastos-v199';

const CORE_ASSETS = [
  './index.html',
  './travel.html',
  './manifest.json',
];

const EXT_URLS = [
  'https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/9.23.0/firebase-database-compat.js',
  'https://www.gstatic.com/firebasejs/9.23.0/firebase-auth-compat.js',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(async c => {
      await c.addAll(CORE_ASSETS);
      await Promise.allSettled(
        EXT_URLS.map(url =>
          fetch(url, { cache: 'force-cache' })
            .then(res => { if (res.ok) c.put(url, res); })
            .catch(() => {})
        )
      );
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
      .then(() => self.clients.matchAll({ includeUncontrolled: true, type: 'window' }))
      .then(clients => Promise.all(clients.map(client => {
        // Navigate the client directly to fresh content — bypasses stale JS and bfcache
        const freshUrl = new URL('./travel.html?_r=' + Date.now(), self.location.href).href;
        return client.navigate(freshUrl)
          .catch(() => client.postMessage({ type: 'SW_UPDATED' }));
      })))
  );
});

// Allow page to trigger skipWaiting explicitly
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = e.request.url;

  // version.json — sempre da rede, nunca do cache
  if (url.includes('version.json')) {
    e.respondWith(fetch(e.request, { cache: 'no-store' }).catch(() => new Response('{"v":0}', { status: 200 })));
    return;
  }

  // travel.html — sempre da rede com timestamp único; fallback para cache se offline
  if (url.includes('travel.html')) {
    const freshUrl = url.split('?')[0] + '?_r=' + Date.now();
    e.respondWith(
      fetch(new Request(freshUrl, { cache: 'no-store' }))
        .then(res => {
          if (res.ok) caches.open(CACHE).then(c => c.put('./travel.html', res.clone()));
          return res;
        })
        .catch(() => caches.match('./travel.html'))
    );
    return;
  }

  // index.html — sempre da rede; fallback para cache se offline
  if (e.request.mode=='navigate'|| url.endsWith('/') || url.includes('index.html')) {
    e.respondWith(
      fetch(e.request, { cache: 'no-store' })
        .then(res => {
          if (res.ok) caches.open(CACHE).then(c => c.put(e.request, res.clone()));
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // Firebase / auth APIs — sempre rede
  if (url.includes('firebaseio.com') || url.includes('googleapis.com') || url.includes('firebaseapp.com')) {
    e.respondWith(fetch(e.request).catch(() => new Response('', { status: 503 })));
    return;
  }

  // External CDN — cache-first
  const isExt = url.includes('gstatic.com') || url.includes('cloudflare.com');
  if (isExt) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(res => {
          if (res.ok) caches.open(CACHE).then(c => c.put(e.request, res.clone()));
          return res;
        }).catch(() => new Response('', { status: 503 }));
      })
    );
    return;
  }

  // Todo o resto — cache-first
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res.ok) caches.open(CACHE).then(c => c.put(e.request, res.clone()));
        return res;
      });
    })
  );
});
