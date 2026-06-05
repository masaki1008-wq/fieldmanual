// Service Worker - 動画キャッシュ
const VIDEO_CACHE = 'fm-videos-v1';
const APP_CACHE   = 'fm-app-v1';

// キャッシュするアプリファイル
const APP_FILES = ['/', '/index.html', '/アプリ用.png', '/アプリデザイン用.png'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(APP_CACHE)
      .then(c => c.addAll(APP_FILES).catch(()=>{}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys
        .filter(k => k !== VIDEO_CACHE && k !== APP_CACHE)
        .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = e.request.url;

  // Firebase Storage の動画リクエストをキャッシュ
  if(url.includes('firebasestorage.googleapis.com') && url.includes('recording.')){
    e.respondWith(
      caches.open(VIDEO_CACHE).then(async cache => {
        // キャッシュキー（トークンを除いたURL）
        const cacheKey = url.split('?')[0];
        const cached = await cache.match(cacheKey);
        if(cached){
          return cached; // キャッシュから即返す
        }
        // ネットワークから取得してキャッシュに保存
        try {
          const res = await fetch(e.request);
          if(res.ok && res.status === 200){
            // Rangeリクエストはキャッシュしない（部分的なレスポンスのため）
            if(!e.request.headers.get('range')){
              cache.put(cacheKey, res.clone());
            }
          }
          return res;
        } catch(err) {
          return cached || new Response('', {status: 503});
        }
      })
    );
    return;
  }

  // アプリファイル（HTML/画像）はキャッシュ優先
  if(url.includes(self.location.origin) && !url.includes('firebasestorage')){
    e.respondWith(
      caches.match(e.request).then(cached => cached || fetch(e.request))
    );
  }
});
