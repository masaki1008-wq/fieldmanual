// Service Worker - 動画・添付ファイルキャッシュ
const APP_CACHE   = 'fm-app-v4';
const VIDEO_CACHE = 'fm-videos-v2';
const FILE_CACHE  = 'fm-files-v1';

// 添付ファイルキャッシュの上限（部門・チームで工程数が増えても容量を抑える）
const FILE_CACHE_MAX_ENTRIES = 80;            // 最大キャッシュ件数（超過分は古い順に削除）
const FILE_CACHE_MAX_BYTES   = 15*1024*1024;  // これより大きいファイルはキャッシュしない

// キャッシュするアプリファイル
const APP_FILES = [
  '/', '/index.html',
  '/アプリ用.png', '/アプリデザイン用.png',
  'https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&display=swap',
  'https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth-compat.js',
  'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore-compat.js',
  'https://www.gstatic.com/firebasejs/10.12.0/firebase-storage-compat.js',
];

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
        .filter(k => ![VIDEO_CACHE, APP_CACHE, FILE_CACHE].includes(k))
        .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// キャッシュ件数が上限を超えたら古いものから削除（FIFO）
async function trimCache(cacheName, maxEntries){
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  const excess = keys.length - maxEntries;
  for(let i=0; i<excess; i++) await cache.delete(keys[i]);
}

self.addEventListener('fetch', e => {
  const url = e.request.url;

  // Firebase Storage の動画（録画・端末アップロードどちらも）をキャッシュ
  if(url.includes('firebasestorage.googleapis.com') && url.includes('videos%2F')){
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
          const isRange = !!e.request.headers.get('range');
          const cacheable = res.ok || res.type==='opaque';
          if(cacheable && !isRange){
            cache.put(cacheKey, res.clone());
          } else if(cacheable && isRange){
            // Rangeリクエストはそのまま返しつつ、バックグラウンドでフル取得してキャッシュ
            // 次回再生時はキャッシュから即座に返せる
            fetch(url).then(full => {
              if(full.ok || full.type==='opaque') cache.put(cacheKey, full);
            }).catch(()=>{});
          }
          return res;
        } catch(err) {
          return cached || new Response('', {status: 503});
        }
      })
    );
    return;
  }

  // 添付ファイル（画像・PDFなど）をキャッシュ。件数上限を超える場合は
  // 古いものから自動的に削除する（部門・チームで工程数が増えても容量を抑制）
  if(url.includes('firebasestorage.googleapis.com') && url.includes('files%2F')){
    e.respondWith(
      caches.open(FILE_CACHE).then(async cache => {
        const cacheKey = url.split('?')[0];
        const cached = await cache.match(cacheKey);
        if(cached){
          return cached;
        }
        try {
          const res = await fetch(e.request);
          // <img src>/<iframe src> はno-corsのためopaque応答(status:0、サイズ不明)になる場合がある
          const isOpaque = res.type === 'opaque';
          const cacheable = (res.ok || isOpaque) && !e.request.headers.get('range');
          if(cacheable){
            const len = isOpaque ? 0 : parseInt(res.headers.get('content-length')||'0', 10);
            if(!len || len <= FILE_CACHE_MAX_BYTES){
              await cache.put(cacheKey, res.clone());
              trimCache(FILE_CACHE, FILE_CACHE_MAX_ENTRIES);
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

  // index.html はネットワーク優先（常に最新版を取得し、オフライン時だけキャッシュを使用）
  if((url.endsWith('/') || url.endsWith('/index.html')) && url.includes(self.location.origin)){
    e.respondWith(
      fetch(e.request)
        .then(res => {
          const c = caches.open(APP_CACHE).then(cache => cache.put(e.request, res.clone()));
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // その他のアプリファイル（画像など）はキャッシュ優先
  if(url.includes(self.location.origin) && !url.includes('firebasestorage')){
    e.respondWith(
      caches.match(e.request).then(cached => cached || fetch(e.request))
    );
  }
});
